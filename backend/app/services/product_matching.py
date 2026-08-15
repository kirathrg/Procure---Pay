"""Matches free-text item names (from chat, OCR, etc.) to a real catalog
Product — deterministic string matching, no AI call. Tolerates plurals,
typos, and partial phrasing ("filing cabinet" -> "Filing Cabinets", "flling
cabinets" -> "Filing Cabinets") while still rejecting genuinely unrelated
text ("usb cable" -> no match), which a pure fuzzy-ratio threshold alone
can't reliably separate — see the word-overlap requirement below.
"""

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product

_MIN_TOKEN_SET_RATIO = 50
_MIN_WORD_OVERLAP = 0.5


def _word_overlap(query: str, candidate: str) -> float:
    query_words = set(query.lower().split())
    if not query_words:
        return 0.0
    candidate_words = set(candidate.lower().split())
    return len(query_words & candidate_words) / len(query_words)


async def find_matching_product(db: AsyncSession, item_text: str) -> Product | None:
    """Best catalog match for `item_text`, or None if nothing is close
    enough. Requires both a token-set similarity score and a minimum
    fraction of the query's words to appear in the product name — ratio
    alone lets short unrelated phrases (e.g. "usb cable") score high enough
    against an unrelated product to false-match; the word-overlap check
    closes that gap without needing a hand-tuned single threshold."""
    item_text = item_text.strip()
    if not item_text:
        return None

    products = (await db.execute(select(Product))).scalars().all()
    if not products:
        return None

    best_product: Product | None = None
    best_score = -1.0
    for product in products:
        ratio = fuzz.token_set_ratio(item_text, product.name)
        overlap = _word_overlap(item_text, product.name)
        if ratio >= _MIN_TOKEN_SET_RATIO and overlap >= _MIN_WORD_OVERLAP and ratio > best_score:
            best_score = ratio
            best_product = product

    return best_product
