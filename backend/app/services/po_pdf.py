"""Renders a PurchaseOrder as a PDF matching the on-screen document in
Sourcing.tsx — same fields, same tax math (a flat 8% rate applied on top of
the stored total; there is no separate tax column, this mirrors the
frontend's client-side calculation exactly so the PDF and the screen never
disagree). Used by both the download endpoint and the email-to-supplier
endpoint (as an attachment) — one PDF builder, two delivery paths.
"""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

from app.models import PurchaseOrder
from app.schemas.purchase_order import ALLOCATION_PO_TYPES

TAX_RATE = 0.08

_TITLE_STYLE = ParagraphStyle("Title", fontName="Helvetica-Bold", fontSize=18, leading=22)
_LABEL_STYLE = ParagraphStyle("Label", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#888888"))
_VALUE_STYLE = ParagraphStyle("Value", fontName="Helvetica-Bold", fontSize=10, leading=13)
_SUB_STYLE = ParagraphStyle("Sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#666666"))
_NOTE_STYLE = ParagraphStyle("Note", fontName="Helvetica-Oblique", fontSize=8, textColor=colors.HexColor("#888888"))


def render_po_pdf(po: PurchaseOrder) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
    )
    story = []

    subtotal = float(po.total)
    tax = round(subtotal * TAX_RATE)
    grand_total = subtotal + tax

    header_table = Table(
        [
            [
                Paragraph("P2P Inc.", ParagraphStyle("Company", fontName="Helvetica-Bold", fontSize=13)),
                Paragraph("Purchase Order", _TITLE_STYLE),
            ],
            [
                Paragraph("4th Floor, Anna Salai<br/>Chennai, TN 600002, IN<br/>billing@procurepay.example", _SUB_STYLE),
                Paragraph(f"{po.po_number}<br/>{po.po_type.capitalize()} · Issued", _SUB_STYLE),
            ],
        ],
        colWidths=[3.5 * inch, 3.5 * inch],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, -1), "RIGHT")]))
    story.append(header_table)
    story.append(Spacer(1, 16))

    # Vendor email can be long — its own row, smaller/lighter style so it
    # wraps like a normal sentence instead of breaking mid-word in a narrow
    # bold column.
    vendor_email_style = ParagraphStyle("VendorEmail", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#555555"))
    details_table = Table(
        [
            [
                Paragraph("VENDOR", _LABEL_STYLE),
                Paragraph("BUYER", _LABEL_STYLE),
                Paragraph("ISSUED", _LABEL_STYLE),
            ],
            [
                Paragraph(po.supplier.name, _VALUE_STYLE),
                Paragraph(f"{po.buyer.name}<br/>{po.buyer.department}", _VALUE_STYLE),
                Paragraph(f"{po.issued_date.isoformat()}<br/>Due on receipt", _VALUE_STYLE),
            ],
            [
                Paragraph(po.supplier.contact_email, vendor_email_style),
                "",
                "",
            ],
        ],
        colWidths=[2.6 * inch, 2.2 * inch, 2.2 * inch],
    )
    details_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(details_table)
    story.append(Spacer(1, 16))

    # Planned/blanket/contract POs carry a spend ceiling + validity window —
    # same block Sourcing.tsx shows on screen; standard POs have none.
    if po.po_type in ALLOCATION_PO_TYPES and po.bucket_ceiling is not None:
        ceiling = float(po.bucket_ceiling)
        released = float(po.bucket_released or 0)
        remaining = ceiling - released
        allocation_table = Table(
            [
                [
                    Paragraph(f"{po.po_type.upper()} ALLOCATION", _LABEL_STYLE),
                    "",
                    "",
                ],
                [
                    Paragraph("Ceiling", _LABEL_STYLE),
                    Paragraph("Released", _LABEL_STYLE),
                    Paragraph("Remaining", _LABEL_STYLE),
                ],
                [
                    Paragraph(f"${ceiling:,.2f}", _VALUE_STYLE),
                    Paragraph(f"${released:,.2f}", _VALUE_STYLE),
                    Paragraph(f"${remaining:,.2f}", _VALUE_STYLE),
                ],
            ],
            colWidths=[2.2 * inch, 2.2 * inch, 2.2 * inch],
        )
        allocation_table.setStyle(
            TableStyle(
                [
                    ("SPAN", (0, 0), (-1, 0)),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(allocation_table)
        if po.bucket_valid_from and po.bucket_valid_to:
            story.append(
                Paragraph(
                    f"Valid {po.bucket_valid_from.isoformat()} through {po.bucket_valid_to.isoformat()}",
                    _SUB_STYLE,
                )
            )
        story.append(Spacer(1, 16))

    line_items = Table(
        [
            ["Description", "Qty", "Unit price", "Amount"],
            [po.item, str(po.quantity), f"${float(po.unit_price):.2f}", f"${subtotal:,.2f}"],
        ],
        colWidths=[3.2 * inch, 1.2 * inch, 1.5 * inch, 1.1 * inch],
    )
    line_items.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#dddddd")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(line_items)
    story.append(Spacer(1, 10))

    totals_table = Table(
        [
            ["Subtotal", f"${subtotal:,.2f}"],
            ["Tax (8%)", f"${tax:,.2f}"],
            ["Total due", f"${grand_total:,.2f}"],
        ],
        colWidths=[5.4 * inch, 1.6 * inch],
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
                ("LINEABOVE", (0, 2), (-1, 2), 0.5, colors.HexColor("#dddddd")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 20))
    story.append(Paragraph("Auto-generated from requisition · approved without manual line-item entry", _NOTE_STYLE))

    doc.build(story)
    return buffer.getvalue()
