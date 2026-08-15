"""Turns a confirmed requisition session into a real PurchaseOrder — the
step that was previously missing entirely (a "routed" session used to just
sit there with no PO ever created). Deterministic throughout: item-to-product
matching is fuzzy string matching (see services/product_matching.py, handles
plurals/typos), supplier selection reuses services/sourcing.py's price
ranking, quantity parsing is a regex. No Gemini call in this path (the
ranking's explanation text is fetched separately by the frontend via
GET /purchase-orders/{id}/candidate-suppliers, same as the Sourcing page for
any other PO).
"""

import re
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Buyer, Product, PurchaseOrder, PurchaseRequisition, RequisitionSession, User
from app.services.product_matching import find_matching_product
from app.services.sourcing import rank_suppliers_for_product

_QUANTITY_RE = re.compile(r"(\d[\d,]*)")


@dataclass
class RoutingResult:
    purchase_order: PurchaseOrder | None
    failure_reason: str | None = None
    """Set (purchase_order is None) when the requisition couldn't be turned
    into a PO — e.g. no catalog match, no eligible supplier, unparsable
    quantity. Always a real, honest reason, never a fabricated PO."""


def _parse_quantity(raw: str) -> int | None:
    match = _QUANTITY_RE.search(raw or "")
    if not match:
        return None
    try:
        qty = int(match.group(1).replace(",", ""))
    except ValueError:
        return None
    return qty if qty > 0 else None


async def _next_po_number(db: AsyncSession) -> str:
    """PO-#### where #### is one higher than the current max. Seed data uses
    hand-picked numbers in the 4400s-4500s range, so this naturally continues
    from wherever the highest existing PO left off rather than colliding."""
    existing = (await db.execute(select(PurchaseOrder.po_number))).scalars().all()
    max_num = 4500
    for po_number in existing:
        match = re.match(r"^PO-(\d+)$", po_number)
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"PO-{max_num + 1}"


async def _resolve_buyer_id(db: AsyncSession, user: User) -> object:
    """Requisition sessions only carry a user, not a Buyer row — POs need a
    Buyer FK, so one is created from the user's profile on first use and
    reused after that (matched by email, same as get_or_create_user)."""
    existing = (await db.execute(select(Buyer).where(Buyer.email == user.email))).scalar_one_or_none()
    if existing is not None:
        return existing.id

    buyer = Buyer(name=user.name, email=user.email, department=user.role)
    db.add(buyer)
    await db.flush()
    return buyer.id


async def route_requisition_to_po(
    db: AsyncSession, session: RequisitionSession | None, slots: dict[str, str], user: User
) -> RoutingResult:
    """Creates a new PurchaseOrder for this specific requisition (never reuses
    or overwrites an existing PO — each confirmed requisition gets its own
    row) if the item matches a real catalog product with an eligible
    supplier. Returns a RoutingResult explaining why not, otherwise.

    `session` is None when called from a source that isn't a chat requisition
    (e.g. a procurement lead approving a warehouse employee's PR) — in that
    case there's no RequisitionSession.po_id to set."""
    item_text = (slots.get("item") or "").strip()
    if not item_text:
        return RoutingResult(None, "No item was captured for this requisition.")

    quantity = _parse_quantity(slots.get("quantity", ""))
    if quantity is None:
        return RoutingResult(None, f"Could not determine a valid quantity from '{slots.get('quantity')}'.")

    product = await find_matching_product(db, item_text)
    if product is None:
        return RoutingResult(
            None, f"'{item_text}' isn't in the product catalog yet, so no supplier could be matched."
        )

    ranked = await rank_suppliers_for_product(db, product, quantity)
    if not ranked:
        return RoutingResult(None, f"No supplier is currently linked to '{item_text}'.")

    picked = ranked[0]
    buyer_id = await _resolve_buyer_id(db, user)
    po_number = await _next_po_number(db)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=picked.supplier_id,
        buyer_id=buyer_id,
        created_by=user.id,
        # The catalog's canonical name/casing, not the raw extracted text —
        # keeps downstream lookups (candidate-suppliers, search) consistent
        # regardless of how the user phrased the item in chat.
        item=product.name,
        quantity=quantity,
        unit_price=picked.unit_price,
        total=picked.total_price,
        issued_date=date.today(),
        status="pending",
        po_type="standard",
    )
    db.add(po)
    await db.flush()

    if session is not None:
        session.po_id = po.id

    await _link_matching_pending_pr(db, product, po)

    return RoutingResult(po)


async def _link_matching_pending_pr(db: AsyncSession, product: Product, po: PurchaseOrder) -> None:
    """A PO can be created two ways: a procurement lead approving a warehouse
    employee's PR (which sets pr.po_id directly in routers/purchase_requisitions.py),
    or a plain chat requisition for the same item, created independently of
    any PR. The latter path used to leave a matching pending PR permanently
    unlinked — it would sit "pending" forever even after its PO fully
    completed, since nothing ever pointed the PR at the PO that actually
    fulfills it. Matched on the product's canonical name (not raw free text)
    since that's what both a PR's item field and find_matching_product
    ultimately resolve to; matched across any requester, not just the PO's
    creator, since a procurement lead requisitioning the same item is
    fulfilling the request regardless of who typed it into a PR."""
    pending_prs = (
        await db.execute(
            select(PurchaseRequisition).where(
                PurchaseRequisition.status == "pending", PurchaseRequisition.po_id.is_(None)
            )
        )
    ).scalars().all()
    for pr in pending_prs:
        matched_product = await find_matching_product(db, pr.item)
        if matched_product is not None and matched_product.id == product.id:
            pr.po_id = po.id
            pr.status = "in_progress"
            break
