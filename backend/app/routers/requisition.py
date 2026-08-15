import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from groq import APIConnectionError, APIStatusError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import ChatMessage, RequisitionSession
from app.schemas.requisition import RequisitionSessionOut, SendMessageIn, SendMessageOut, TranscribeOut
from app.services.gemini import get_gemini_service
from app.services.product_matching import find_matching_product
from app.services.requisition_routing import route_requisition_to_po
from app.services.stt import SttNotConfiguredError, transcribe_audio
from app.services.users import get_or_create_user

router = APIRouter(prefix="/requisition", tags=["requisition"])

OPENING_MESSAGE = "What do you need sourced?"

# Deterministic backstop for the model's user_confirmed flag: a smaller local
# model can miss that a reply combining new detail with a go-ahead (e.g.
# "next week, and yes go ahead") is a confirmation rather than just more
# detail to gather (seen in testing — it asked a follow-up question instead
# of routing). If the session was already ready to confirm and the new
# message contains a clear affirmative phrase anywhere in it, treat it as
# confirmed regardless of what the model decided. Matched as a whole phrase
# with word boundaries so it doesn't fire on "ok" inside an unrelated word.
_AFFIRMATIVE_RE = re.compile(
    r"\b(yes|yeah|yep|yup|sure|ok|okay|go ahead|go for it|sounds good|looks good|submit it|do it|confirmed?)\b",
    re.IGNORECASE,
)


def _looks_like_affirmative(text: str) -> bool:
    return bool(_AFFIRMATIVE_RE.search(text.strip()))


# Deterministic filter for the model's extracted slots: a small local model
# will sometimes hallucinate a value instead of leaving a slot empty when
# nothing was actually said (seen in testing — a bare "hi" with zero real
# content produced urgency: "normal", and on one run every slot was filled
# with the literal string "unknown" as if that were a captured value).
# "normal" is also literally the schema's own example default for urgency,
# so the model echoing it back is indistinguishable from a real answer
# unless it's filtered here.
_PLACEHOLDER_VALUES = {"unknown", "n/a", "none", "not specified", "not sure", "tbd", "null"}

# Fixed question order the summary card is built around. The model decides
# *how* to phrase a question and extracts whatever the user actually said,
# but never decides *which* slot to ask about next — left to the model that
# order was inconsistent turn to turn (seen in testing: it would jump straight
# to urgency after quantity, or silently default urgency to "normal" without
# ever asking), which made the summary card fill in a different order every
# run. Deadline/urgency/priority are treated as one interchangeable "when do
# you need it" question since asking all three separately is tedious and the
# routing logic only requires one of them.
_SLOT_ORDER = ["item", "quantity", "deadline", "urgency", "priority"]
_NEXT_QUESTION = {
    "item": "What do you need sourced?",
    "quantity": "How many {item} do you need?",
    "deadline": "When do you need the {item} by, and how urgent is this (low/normal/urgent)?",
}

# Every system-authored message in the conversation renders from one of these
# fixed templates — never from the model's own "reply" text — so the chat
# always asks/states things the same way turn to turn, regardless of which
# LLM is behind it or how it chose to phrase things.
_CONFIRM_TEMPLATE = (
    "Confirm: {item} × {quantity}, needed by {deadline} ({urgency}). Reply yes to submit."
)
_UNMATCHED_ITEM_TEMPLATE = "'{item}' isn't in the product catalog, so I can't source it. What would you like instead?"
_ROUTED_TEMPLATE = "Done — created {po_number} for {item}."
_ROUTING_FAILED_TEMPLATE = "I wasn't able to create a purchase order: {reason}"


def _format_confirmation(slots: dict[str, str]) -> str:
    return _CONFIRM_TEMPLATE.format(
        item=slots.get("item", "this item"),
        quantity=slots.get("quantity", "an unspecified quantity"),
        deadline=slots.get("deadline", "no specific date"),
        urgency=slots.get("urgency", "normal"),
    )


def _next_missing_slot(slots: dict[str, str]) -> str | None:
    for key in _SLOT_ORDER:
        if key in ("deadline", "urgency", "priority"):
            # Interchangeable "when/how urgent" question — any one of the
            # three being filled counts as this step being answered.
            if not any(slots.get(k) for k in ("deadline", "urgency", "priority")):
                return "deadline"
            continue
        if not slots.get(key):
            return key
    return None


# Matches a bare "45", "45 units", "45 chairs" — used to detect when the
# model has run the item text into the quantity slot instead of extracting
# just the count (seen in testing: "need 45 ergonomic office chairs" ->
# quantity: "45 ergonomic office chairs" instead of quantity: "45").
_LEADING_QUANTITY_RE = re.compile(r"^(\d[\d,]*(?:\.\d+)?)\s*(\S+)?")


def _dequantify(item: str | None, quantity: str) -> str:
    """If quantity is just a number, or a number plus a real unit word
    (units/pcs/ea/each/boxes/...), leave it alone. If it instead runs on
    into what's clearly the item text — the classic failure mode is the
    model echoing the whole item name after the number — trim it back to
    just the leading number (+ short unit word, if any)."""
    match = _LEADING_QUANTITY_RE.match(quantity)
    if not match:
        return quantity
    number, trailing = match.group(1), match.group(2)
    if trailing is None:
        return quantity
    # A short, plausible unit word (few chars, mostly letters) is kept as
    # part of the quantity ("45 units", "45 boxes"). Anything longer, or
    # that's actually the start of the stated item text, gets dropped —
    # the number alone is still a complete, correct quantity value.
    looks_like_unit = len(trailing) <= 6 and trailing.isalpha()
    item_leaks_into_quantity = item is not None and quantity.lower().startswith(f"{number} {item.lower()}"[: len(quantity)])
    if item_leaks_into_quantity or not looks_like_unit:
        return number
    return quantity


def _clean_slots(raw_slots: dict[str, str]) -> dict[str, str]:
    cleaned = {}
    for key, value in raw_slots.items():
        value = (value or "").strip()
        if not value or value.lower() in _PLACEHOLDER_VALUES:
            continue
        cleaned[key] = value

    # Confirmed by direct testing: a bare greeting ("hi", "hello", "good
    # morning") with zero real procurement content reliably produces a lone
    # urgency: "normal" — the schema's own documented default value for that
    # field, echoed back with nothing to support it. A message that actually
    # states real content produces item/quantity/a non-default urgency
    # alongside it, so "urgency is the *only* slot, and it's exactly
    # 'normal'" is a strong, specific signal of this hallucination rather
    # than a real answer.
    if set(cleaned.keys()) == {"urgency"} and cleaned["urgency"].lower() == "normal":
        return {}

    if "quantity" in cleaned:
        cleaned["quantity"] = _dequantify(cleaned.get("item"), cleaned["quantity"])

    return cleaned


@router.post("/transcribe", response_model=TranscribeOut)
async def transcribe(
    file: UploadFile,
    _user: CurrentUser = Depends(get_current_user),
) -> TranscribeOut:
    """Speech-to-text for the chat composer's mic button. Transcribes and
    hands the text back for the user to review/edit before sending — never
    auto-sent, since a misheard word (item names, quantities) is exactly the
    kind of mistake that shouldn't go straight into a purchase order."""
    audio_bytes = await file.read()
    try:
        text = await run_in_threadpool(transcribe_audio, audio_bytes, file.filename or "recording.webm")
    except SttNotConfiguredError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    return TranscribeOut(text=text)


@router.post("/sessions", response_model=RequisitionSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> RequisitionSession:
    user = await get_or_create_user(db, current_user)
    session = RequisitionSession(user_id=user.id, status="active")
    session.messages = [ChatMessage(role="assistant", content=OPENING_MESSAGE)]
    db.add(session)
    await db.commit()
    await db.refresh(session, attribute_names=["messages"])
    return session


@router.get("/sessions/{session_id}", response_model=RequisitionSessionOut)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> RequisitionSession:
    """Restores an in-progress conversation's full message history — needed
    so the Requisition chat can survive navigating away and back (or a page
    reload) before a PO has been created, instead of the whole conversation
    silently vanishing (the frontend only held it in unpersisted component
    state) with no way back to where the user left off."""
    result = await db.execute(
        select(RequisitionSession)
        .where(RequisitionSession.id == session_id)
        .options(selectinload(RequisitionSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requisition session not found")

    user = await get_or_create_user(db, current_user)
    if session.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your session")

    session.messages.sort(key=lambda m: m.created_at)
    return session


@router.post("/sessions/{session_id}/messages", response_model=SendMessageOut)
async def send_message(
    session_id: uuid.UUID,
    payload: SendMessageIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> SendMessageOut:
    result = await db.execute(
        select(RequisitionSession)
        .where(RequisitionSession.id == session_id)
        .options(selectinload(RequisitionSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requisition session not found")

    user = await get_or_create_user(db, current_user)
    if session.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your session")

    session.messages.sort(key=lambda m: m.created_at)
    history = [{"role": m.role, "content": m.content} for m in session.messages]
    history.append({"role": "user", "content": payload.content})

    gemini = get_gemini_service()
    try:
        result_data = await gemini.requisition_turn(history)
    except APIConnectionError as e:
        # Groq's API is unreachable (network issue, DNS, etc). Don't persist
        # the user's message — a retry once connectivity is back shouldn't
        # replay this turn on top of a half-saved one.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The assistant is temporarily unavailable. Please try again.",
        ) from e
    except (APIStatusError, ValueError) as e:
        # APIStatusError: Groq rejected the request (rate limit, bad model
        # name, etc). ValueError: the model's output wasn't valid JSON for
        # the schema — a real failure mode under load.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The assistant is temporarily unavailable. Please try again."
        ) from e

    user_message = ChatMessage(session_id=session.id, role="user", content=payload.content)
    db.add(user_message)
    session.messages.append(user_message)

    # Every field the model extracted from this message, whether it's one
    # field or several at once — no longer restricted to only the field the
    # fixed question order was currently asking about, so a user who states
    # everything up front gets all of it captured in one turn.
    this_turn_slots = _clean_slots(result_data.get("slots", {}))

    # An item the model extracted has to actually exist in the catalog —
    # otherwise the conversation collects quantity/timing for something that
    # can never become a real PO, and only fails at the very end when
    # routing runs (see services/requisition_routing.py). Same fuzzy match
    # used there, run here instead so an unknown item ("cable", with no
    # catalog match) is caught immediately and re-asked, not accepted.
    unmatched_item: str | None = None
    if "item" in this_turn_slots:
        matched_product = await find_matching_product(db, this_turn_slots["item"])
        if matched_product is None:
            unmatched_item = this_turn_slots.pop("item")

    # Slots accumulate across the whole conversation — the confirmation turn
    # ("yes go ahead") typically carries no new slots itself, so routing must
    # look at everything captured so far, not just this turn's extraction.
    all_slots: dict[str, str] = dict(this_turn_slots)
    for m in session.messages:
        if m.slots:
            for s in m.slots:
                all_slots.setdefault(s["key"], s["value"])

    # Deterministic backstop, same reasoning as the confirmation-detection
    # guard: a small local model can mark ready_to_confirm/user_confirmed true
    # on a single-sentence message ("led desk lamp") that never actually gave
    # a quantity. Item + quantity are the two fields route_requisition_to_po
    # cannot proceed without, so neither confirming nor routing is allowed
    # until both are present, regardless of what the model decided.
    has_required_slots = bool(all_slots.get("item")) and bool(all_slots.get("quantity"))

    was_confirmable = session.status == "confirmed"
    should_route = has_required_slots and (
        result_data.get("user_confirmed")
        or (was_confirmable and _looks_like_affirmative(payload.content))
    )
    # A slot the fixed order still considers missing overrides the model's
    # own ready_to_confirm — otherwise a model that's eager to wrap up can
    # mark itself ready before deadline/urgency/priority was ever asked.
    next_missing = _next_missing_slot(all_slots)
    should_confirm = has_required_slots and result_data.get("ready_to_confirm") and next_missing is None

    # Every branch below sets reply_text from a fixed template — the model's
    # own "reply" text (result_data["reply"]) is never shown to the user. The
    # model's only real job is slot extraction; what the assistant actually
    # says is fully owned here, so the chat asks/states things in exactly the
    # same words every run regardless of which LLM is behind it.
    po_number: str | None = None
    routing_failure_reason: str | None = None
    if should_route:
        session.status = "routed"
        routing_result = await route_requisition_to_po(db, session, all_slots, user)
        if routing_result.purchase_order is not None:
            po_number = routing_result.purchase_order.po_number
            # This becomes the PO every module (Sourcing, Receiving,
            # Invoicing) follows until it completes a full cycle — see
            # PurchaseOrder status transitions, which clear this.
            user.active_po_id = routing_result.purchase_order.id
            reply_text = _ROUTED_TEMPLATE.format(po_number=po_number, item=all_slots.get("item", "this item"))
        else:
            routing_failure_reason = routing_result.failure_reason
            reply_text = _ROUTING_FAILED_TEMPLATE.format(reason=routing_failure_reason)
    elif should_confirm:
        session.status = "confirmed"
        reply_text = _format_confirmation(all_slots)
    elif unmatched_item is not None:
        reply_text = _UNMATCHED_ITEM_TEMPLATE.format(item=unmatched_item)
    elif next_missing is not None and next_missing in _NEXT_QUESTION:
        # Override the model's own question choice with the fixed order so
        # the summary card fills in the same sequence every run, regardless
        # of what the model decided to ask about next.
        reply_text = _NEXT_QUESTION[next_missing].format(item=all_slots.get("item", "that"))
    else:
        # Nothing left for the fixed order to ask about, but this turn
        # didn't route or freshly confirm (e.g. status was already
        # "confirmed" and the user's reply wasn't recognized as an
        # affirmative, or ready_to_confirm hadn't been flagged yet) —
        # always re-show the fixed confirmation prompt rather than ever
        # falling back to unscripted model text.
        reply_text = _format_confirmation(all_slots)

    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=reply_text,
        slots=[{"key": k, "label": k.capitalize(), "value": v} for k, v in this_turn_slots.items()] or None,
    )
    db.add(assistant_message)
    session.messages.append(assistant_message)

    await db.commit()
    await db.refresh(session, attribute_names=["messages"])

    return SendMessageOut(
        session=RequisitionSessionOut.model_validate(session),
        ready_to_confirm=session.status in ("confirmed", "routed"),
        po_number=po_number,
        routing_failure_reason=routing_failure_reason,
    )
