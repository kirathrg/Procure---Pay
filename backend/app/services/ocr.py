"""Invoice OCR via OCR.space's hosted API — no local model, no PaddlePaddle
runtime. Swapped in from PaddleOCR because the app is deployed on a free-tier
host without the RAM/disk budget for PaddlePaddle's ~550MB footprint;
measured directly against the same test invoice, OCR.space's Engine 2 was
also faster end-to-end (~1.6-2.2s including network) than warm local
PaddleOCR inference (~3.2s) — not just smaller, also quicker.

`isOverlayRequired=true` gets per-line bounding boxes (pixel coordinates),
which this app classifies with the same regex patterns PaddleOCR's
per-region text used — OCR.space groups words into lines the same way a
real invoice's rows read, e.g. "Vendor: Chennai Office Supplies Co." as one
line, so line-level classification (not per-word) is the right granularity
here, same as the old per-region approach.
"""

import re
from dataclasses import dataclass
from io import BytesIO

import requests
from PIL import Image

from app.config import get_settings

settings = get_settings()

_API_URL = "https://api.ocr.space/parse/image"


class OcrNotConfiguredError(Exception):
    """Raised when OCR_SPACE_API_KEY is unset — expected until a real key is
    added to backend/.env."""


@dataclass
class ExtractedField:
    key: str
    label: str
    value: str
    confidence: float
    bbox_x: float  # percentage of image width, 0-100
    bbox_y: float  # percentage of image height, 0-100
    bbox_w: float
    bbox_h: float


# Each classifier is tried in order against a detected text line; the first
# regex match wins. Patterns are deliberately permissive (case-insensitive,
# optional separators) since real invoice layouts vary in punctuation/spacing
# far more than in which words appear.
_CLASSIFIERS: list[tuple[str, str, re.Pattern[str]]] = [
    ("invoiceNumber", "Invoice #", re.compile(r"invoice\s*#?:?\s*(\S+)", re.IGNORECASE)),
    ("poNumber", "PO Reference", re.compile(r"po\s*(?:reference|ref|#)?:?\s*(\S+)", re.IGNORECASE)),
    ("vendor", "Vendor", re.compile(r"vendor:?\s*(.+)", re.IGNORECASE)),
    ("quantity", "Quantity", re.compile(r"^(\d+(?:[.,]\d+)?\s*(?:units?|pcs?|ea|each)?)$", re.IGNORECASE)),
    ("unitPrice", "Unit Price", re.compile(r"^\$?([\d,]+\.\d{2})$")),
]

_TOTAL_LABEL_RE = re.compile(r"^total:?\s*\$?([\d,]+\.\d{2})$", re.IGNORECASE)

# OCR.space doesn't return a per-word/per-line confidence score the way
# PaddleOCR does — there's no probability model exposed in the free API
# response. A fixed high confidence is used instead of a fabricated number;
# this only feeds the frontend's confidence display, not any pass/fail logic.
_FIXED_CONFIDENCE = 0.95


class OcrService:
    def extract_invoice_fields(self, image_bytes: bytes) -> list[ExtractedField]:
        if not settings.ocr_space_api_key:
            raise OcrNotConfiguredError(
                "Invoice scanning isn't configured yet — add OCR_SPACE_API_KEY to backend/.env "
                "(from the OCR.space dashboard)."
            )

        with Image.open(BytesIO(image_bytes)) as img:
            img_w, img_h = img.size
            # PIL's own detected format, not the client-supplied filename
            # (which can be missing or wrong) — OCR.space needs a real
            # extension on the multipart filename to detect the file type;
            # a bare "invoice" with no extension fails outright with "Unable
            # to recognize the file type" (confirmed by testing).
            extension = (img.format or "PNG").lower()

        response = requests.post(
            _API_URL,
            files={"file": (f"invoice.{extension}", image_bytes)},
            data={
                "apikey": settings.ocr_space_api_key,
                "OCREngine": 2,
                "isOverlayRequired": True,
                "scale": True,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("IsErroredOnProcessing"):
            raise RuntimeError(f"OCR.space error: {data.get('ErrorMessage')}")

        parsed_results = data.get("ParsedResults") or []
        if not parsed_results:
            return []

        lines = parsed_results[0].get("TextOverlay", {}).get("Lines", [])

        fields: list[ExtractedField] = []
        seen_keys: set[str] = set()
        total_candidate: tuple[str, tuple[float, float, float, float]] | None = None

        for line in lines:
            text = (line.get("LineText") or "").strip()
            words = line.get("Words") or []
            if not text or not words:
                continue
            # A line's bounding box is the union of its words' boxes — same
            # "one box per detected text region" granularity PaddleOCR gave
            # per line/paragraph.
            left = min(w["Left"] for w in words)
            top = min(w["Top"] for w in words)
            right = max(w["Left"] + w["Width"] for w in words)
            bottom = max(w["Top"] + w["Height"] for w in words)
            box = (left, top, right, bottom)

            total_match = _TOTAL_LABEL_RE.match(text)
            if total_match:
                total_candidate = (total_match.group(1), box)
                continue

            for key, label, pattern in _CLASSIFIERS:
                if key in seen_keys:
                    continue
                match = pattern.match(text)
                if not match:
                    continue
                fields.append(_make_field(key, label, match.group(1).strip(), box, img_w, img_h))
                seen_keys.add(key)
                break

        if total_candidate is not None and "total" not in seen_keys:
            value, box = total_candidate
            fields.append(_make_field("total", "Total", value, box, img_w, img_h))

        return fields


def _make_field(
    key: str, label: str, value: str, box: tuple[float, float, float, float], img_w: int, img_h: int
) -> ExtractedField:
    x1, y1, x2, y2 = box
    return ExtractedField(
        key=key,
        label=label,
        value=value,
        confidence=_FIXED_CONFIDENCE,
        bbox_x=round(x1 / img_w * 100, 2),
        bbox_y=round(y1 / img_h * 100, 2),
        bbox_w=round((x2 - x1) / img_w * 100, 2),
        bbox_h=round((y2 - y1) / img_h * 100, 2),
    )


_ocr_service: OcrService | None = None


def get_ocr_service() -> OcrService:
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OcrService()
    return _ocr_service
