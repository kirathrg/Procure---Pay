"""Wraps the two language-model use cases this app needs: the requisition
chatbot's structured slot extraction, and short natural-language narrative
generation (3-way match reasoning, anomaly detail text, sourcing pick
explanation). No vision/OCR calls go through this service — see
services/ocr.py for that; QR decoding for receiving happens client-side in
the browser (see p2p-frontend/src/lib/qrScan.ts), not in the backend at all.

Runs on Groq's hosted API rather than a local model — the app is deployed
without a GPU to run inference on, and this usage (a handful of short,
human-paced calls per requisition/match/anomaly, never bulk or scheduled)
comfortably fits inside Groq's free tier.
"""

import json
import re
from typing import Any

from groq import AsyncGroq

from app.config import get_settings

settings = get_settings()

REQUISITION_SLOTS_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string", "description": "Natural-language assistant reply to show the user"},
        "slots": {
            "type": "object",
            "properties": {
                "item": {"type": "string"},
                "quantity": {"type": "string"},
                "deadline": {"type": "string"},
                "urgency": {"type": "string", "enum": ["low", "normal", "urgent"]},
                "priority": {"type": "string"},
            },
        },
        "ready_to_confirm": {
            "type": "boolean",
            "description": "True once item, quantity, and at least one of deadline/urgency/priority are known",
        },
        "user_confirmed": {
            "type": "boolean",
            "description": (
                "True only if ready_to_confirm was already true on a prior turn AND the user's latest "
                "message is clearly an affirmative go-ahead (e.g. 'yes', 'go ahead', 'looks good', "
                "'submit it') rather than new information or a correction."
            ),
        },
    },
    "required": ["reply", "slots", "ready_to_confirm", "user_confirmed"],
}

REQUISITION_SYSTEM_PROMPT = """You are extracting structured purchase-requisition data from a user's
message in a procurement chatbot. Your only job is extraction — a separate system decides what question
to ask next and writes the actual reply the user sees, so the "reply" field you produce is never shown
to anyone and its exact wording doesn't matter.

Read the user's LATEST message (the assistant's previous message tells you what was just asked, for
context only) and extract every field it genuinely states, all at once — a single message can and often
does answer more than one field, e.g. "need 30 ergonomic chairs by next week, urgent" states item,
quantity, deadline, AND urgency together; extract all four, not just the one most recently asked about.
- "item": what's needed.
- "quantity": how many, including the unit if given.
- "deadline": when it's needed by, if a date/timeframe was given.
- "urgency": exactly one of low, normal, urgent — only if the user said something that actually implies
  urgency or timing pressure (never a free-text phrase like "fairly urgent" — map it to the closest of
  the three).

Do NOT invent or default a value for any field the user did not actually state or clearly imply in THIS
message — in particular, never fill "urgency" with "normal" as a default; leave it out entirely unless
urgency was genuinely communicated. Only extract from the user's latest message, not from things implied
by your own previous question.

Set ready_to_confirm to true once item and quantity are both known (from this message or earlier in the
conversation). Set user_confirmed to true only if the user's latest message is a clear affirmative
go-ahead (e.g. "yes", "go ahead", "looks good", "submit it") with no new corrections; otherwise false.

Respond with a single JSON object matching this schema, and nothing else:
{schema}"""

_MATCH_REASON_SCHEMA = {
    "type": "object",
    "properties": {"reason": {"type": "string"}, "routed_to": {"type": "string"}},
    "required": ["reason", "routed_to"],
}

_THINK_TAG_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def _strip_think_tags(text: str) -> str:
    """Some Groq-hosted reasoning models can emit <think>...</think>
    scratch-work before the real answer if reasoning isn't suppressed via
    reasoning_format. Strip it defensively so it never leaks into
    user-facing text."""
    return _THINK_TAG_RE.sub("", text).strip()


def _json_prompt(prompt: str, schema: dict[str, Any]) -> str:
    return f"{prompt}\n\nRespond with a single JSON object matching this schema, and nothing else:\n{json.dumps(schema)}"


class GeminiService:
    """Name kept for drop-in compatibility with the routers that import it —
    this now talks to Groq's hosted API instead of the Gemini API."""

    def __init__(self) -> None:
        self._client = AsyncGroq(api_key=settings.groq_api_key)

    async def requisition_turn(self, history: list[dict[str, str]]) -> dict[str, Any]:
        """One turn of the requisition chat. `history` is a list of
        {role: "user"|"assistant", content: str} in chronological order."""
        system_prompt = REQUISITION_SYSTEM_PROMPT.format(schema=json.dumps(REQUISITION_SLOTS_SCHEMA))
        messages = [{"role": "system", "content": system_prompt}]
        messages += [{"role": m["role"], "content": m["content"]} for m in history]

        response = await self._client.chat.completions.create(
            model=settings.gemini_chat_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        data = json.loads(_strip_think_tags(response.choices[0].message.content))
        if not data.get("reply") or data["reply"].strip().lower() == "json":
            # Failure mode seen in testing: the model echoes the word "json"
            # instead of writing a real sentence. Fail loudly rather than
            # show that to the user.
            data["reply"] = "Got it — could you tell me a bit more about what you need?"
        return data

    async def generate_match_reason(
        self, po_number: str, mismatches: list[dict[str, str]], auto_approved: bool
    ) -> dict[str, str]:
        """Given already-computed field mismatches (plain Python comparison,
        not this call), phrase the human-readable reason + routing decision."""
        if auto_approved:
            prompt = (
                f"PO {po_number}: all fields matched within tolerance across PO, receipt, and invoice. "
                "Write one short sentence confirming this in a factual, enterprise-software tone."
            )
        else:
            mismatch_lines = "\n".join(f"- {m['label']}: {m['delta_note']}" for m in mismatches)
            prompt = (
                f"PO {po_number} has the following field mismatches between invoice and PO/receipt:\n"
                f"{mismatch_lines}\n\n"
                "Write one short sentence explaining the discrepancy and whether it looks like a normal "
                "variance or something that needs review, in a factual, enterprise-software tone. "
                "Then suggest who it should route to, e.g. 'AP Approver' or a named role."
            )

        response = await self._client.chat.completions.create(
            model=settings.gemini_narrative_model,
            messages=[{"role": "user", "content": _json_prompt(prompt, _MATCH_REASON_SCHEMA)}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        return json.loads(_strip_think_tags(response.choices[0].message.content))

    async def generate_supplier_pick_reason(
        self, item: str, picked: dict[str, Any], candidates: list[dict[str, Any]]
    ) -> str:
        """Given already-ranked candidates (plain Python sort on total price,
        not this call), phrase why the top pick was selected.

        The savings-vs-each-other-candidate deltas are computed here in
        Python and handed to the model as already-correct facts, rather than
        letting the model compute them — smaller models were observed
        getting the arithmetic and direction of a "$X more/less" comparison
        backwards when asked to derive it themselves from raw totals."""
        next_best = min(
            (c for c in candidates if c["supplier_id"] != picked["supplier_id"]),
            key=lambda c: c["total_price"],
            default=None,
        )
        if next_best is not None:
            savings = next_best["total_price"] - picked["total_price"]
            savings_line = (
                f"It is the cheapest option, saving ${savings:,.2f} versus the next-cheapest candidate "
                f"({next_best['name']}, ${next_best['total_price']:,.2f})."
                if savings > 0
                else "It is tied for lowest total price among eligible candidates."
            )
        else:
            savings_line = "It is the only eligible candidate."

        prompt = (
            f"Sourcing decision for '{item}'.\n"
            f"Selected: {picked['name']} — ${picked['total_price']:,.2f} total, "
            f"{picked['lead_time_days']}d lead time, {picked['on_time_rate']:.0f}% on-time delivery.\n"
            f"Fact to convey: {savings_line}\n\n"
            "Write exactly one short sentence, in a factual enterprise-software tone, stating that this "
            "supplier was selected and why, using ONLY the fact given above. Do not invent, recompute, or "
            "restate any other numbers — the savings figure given is already correct, do not alter it."
        )
        response = await self._client.chat.completions.create(
            model=settings.gemini_narrative_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return _strip_think_tags(response.choices[0].message.content)

    async def generate_anomaly_detail(self, anomaly_type: str, data_points: list[str]) -> str:
        """Phrase the narrative `detail` text for an anomaly whose underlying
        detection (similarity score, price delta, split-PO threshold) was
        already computed in plain Python/SQL."""
        prompt = (
            f"Anomaly type: {anomaly_type}\n"
            f"Supporting data points: {', '.join(data_points)}\n\n"
            "Write one short, factual sentence describing this anomaly for a fraud-detection dashboard, "
            "in the style of: \"Invoice #4521 is 98% visually similar to Invoice #4498, submitted 2 days apart.\""
        )
        response = await self._client.chat.completions.create(
            model=settings.gemini_narrative_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return _strip_think_tags(response.choices[0].message.content)


_gemini_service: GeminiService | None = None


def get_gemini_service() -> GeminiService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
