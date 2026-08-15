"""Deterministic 3-way match comparison — plain Python, no Gemini. Gemini is
called separately (see services/gemini.py:generate_match_reason) only to
phrase the human-readable `reason`/`routed_to` text once these field
comparisons already exist. Never asks an LLM to do arithmetic.
"""

import re
from dataclasses import dataclass

from app.models import Invoice, PurchaseOrder, Receipt

# Real-world partial shipments/rounding shouldn't trip an exact-match
# requirement — a small tolerance keeps auto-approval from being needlessly
# strict while still catching genuine discrepancies.
QUANTITY_TOLERANCE = 0  # units; exact match required, receipts should be exact
AMOUNT_TOLERANCE_PCT = 0.02  # 2% variance auto-approved as normal rounding


@dataclass
class FieldComparison:
    label: str
    po_value: str
    receipt_value: str
    invoice_value: str
    is_match: bool
    delta_note: str | None = None


def _parse_number(text: str) -> float | None:
    """Extracts the first numeric value from strings like '45 units',
    '$370.00', '16,650.00'."""
    match = re.search(r"[\d,]+\.?\d*", text)
    if not match:
        return None
    return float(match.group(0).replace(",", ""))


def _invoice_field_value(invoice: Invoice | None, key: str) -> str | None:
    if invoice is None:
        return None
    for f in invoice.fields:
        if f.key == key:
            return f.value
    return None


def compare_po_receipt_invoice(
    po: PurchaseOrder, receipt: Receipt | None, invoice: Invoice | None
) -> list[FieldComparison]:
    fields: list[FieldComparison] = []

    # PO Number — always the join key; only flagged if the invoice's OCR'd
    # PO reference field disagrees (a real OCR misread or wrong-invoice case).
    invoice_po_number = _invoice_field_value(invoice, "poNumber")
    po_number_match = invoice_po_number is None or invoice_po_number == po.po_number
    fields.append(
        FieldComparison(
            label="PO Number",
            po_value=po.po_number,
            receipt_value=po.po_number if receipt else "—",
            invoice_value=invoice_po_number or "—",
            is_match=po_number_match,
            delta_note=None if po_number_match else f"Invoice references {invoice_po_number}, not {po.po_number}",
        )
    )

    # Quantity — PO ordered vs. receipt scanned vs. invoice billed.
    receipt_qty = receipt.scanned_quantity if receipt else None
    invoice_qty_raw = _invoice_field_value(invoice, "quantity")
    invoice_qty = _parse_number(invoice_qty_raw) if invoice_qty_raw else None

    qty_values = [v for v in (receipt_qty, invoice_qty) if v is not None]
    qty_match = all(v == po.quantity for v in qty_values) if qty_values else True
    delta_note = None
    if not qty_match and invoice_qty is not None:
        delta_note = f"Invoice: {int(invoice_qty)} units vs PO: {po.quantity} units"
    fields.append(
        FieldComparison(
            label="Quantity",
            po_value=f"{po.quantity} units",
            receipt_value=f"{receipt_qty} units" if receipt_qty is not None else "—",
            invoice_value=invoice_qty_raw or "—",
            is_match=qty_match,
            delta_note=delta_note,
        )
    )

    # Unit Price — PO vs. invoice only (receipts don't carry price).
    invoice_price_raw = _invoice_field_value(invoice, "unitPrice")
    invoice_price = _parse_number(invoice_price_raw) if invoice_price_raw else None
    price_match = invoice_price is None or abs(invoice_price - float(po.unit_price)) < 0.01
    fields.append(
        FieldComparison(
            label="Unit Price",
            po_value=f"${float(po.unit_price):.2f}",
            receipt_value="—",
            # invoice_price_raw is the OCR'd field value verbatim — it already
            # includes a "$" when the source document had one, so it's shown
            # as-is rather than re-prefixed (which produced "$$370.00").
            invoice_value=invoice_price_raw or "—",
            is_match=price_match,
            delta_note=None if price_match else f"Invoice unit price ${invoice_price:.2f} vs PO ${float(po.unit_price):.2f}",
        )
    )

    # Total Amount — PO vs. invoice, within a small tolerance for rounding.
    invoice_total_raw = _invoice_field_value(invoice, "total")
    invoice_total = _parse_number(invoice_total_raw) if invoice_total_raw else None
    po_total = float(po.total)
    total_match = invoice_total is None or abs(invoice_total - po_total) <= po_total * AMOUNT_TOLERANCE_PCT
    delta_note = None
    if not total_match and invoice_total is not None:
        diff = po_total - invoice_total
        direction = "below" if diff > 0 else "above"
        delta_note = f"Invoice total ${abs(diff):,.2f} {direction} PO"
    fields.append(
        FieldComparison(
            label="Total Amount",
            po_value=f"${po_total:,.2f}",
            receipt_value="—",
            invoice_value=invoice_total_raw or "—",
            is_match=total_match,
            delta_note=delta_note,
        )
    )

    return fields


def determine_outcome(fields: list[FieldComparison]) -> str:
    """auto-approved if every field matches; escalated otherwise."""
    return "auto-approved" if all(f.is_match for f in fields) else "escalated"
