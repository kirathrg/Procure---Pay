/** Suggests catalog product names as the user types a requisition message —
 * e.g. typing "led" while the cursor is on that word surfaces "LED Desk
 * Lamp". Matches against the trailing partial word (or short word run) at
 * the cursor, not the whole message, so "need 10 led" still matches on
 * "led" alone.
 *
 * This only needs to feel responsive against a small catalog (dozens of
 * products, each a few words), so a plain word-prefix scan is enough — no
 * fuzzy-matching library needed for this scale (unlike the backend's
 * item-to-product routing match, which has to tolerate full sentences and
 * typos server-side; see services/product_matching.py).
 */

const MAX_SUGGESTIONS = 5;

/** The word run immediately before the cursor, e.g. "led" from "need 10 led|". */
export function currentWordAt(text: string, cursor: number): string {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(/[a-zA-Z]+$/);
  return match ? match[0] : "";
}

/** Strips a common plural suffix so "laptops"/"chairs"/"boxes" line up with
 * a catalog word stored in singular form ("Laptop", "Chair", "Box"), and
 * vice versa via the caller checking both directions. Deliberately simple
 * (no stemming library) — this only needs to bridge the handful of regular
 * English plurals real spoken/typed item names use, not handle every
 * irregular case. */
function withoutTrailingS(word: string): string {
  if (word.endsWith("ies") && word.length > 3) return word.slice(0, -3) + "y"; // "batteries" -> "battery"
  if (word.endsWith("es") && word.length > 2) return word.slice(0, -2); // "boxes" -> "box"
  if (word.endsWith("s") && word.length > 1) return word.slice(0, -1); // "laptops" -> "laptop"
  return word;
}

function wordsMatch(query: string, catalogWord: string): boolean {
  if (catalogWord.startsWith(query) || query.startsWith(catalogWord)) return true;
  const bareQuery = withoutTrailingS(query);
  const bareCatalog = withoutTrailingS(catalogWord);
  return bareCatalog.startsWith(bareQuery) || bareQuery.startsWith(bareCatalog);
}

export function suggestProducts(partial: string, productNames: string[]): string[] {
  const query = partial.trim().toLowerCase();
  if (query.length < 2) return [];

  // A single-word query (the common typing case) only needs a prefix/substring
  // hit; a multi-word query (typically a whole phrase from voice transcription,
  // e.g. "ergonomic office chair") is matched more loosely — every query word
  // just has to appear somewhere in the product name, in any order — since an
  // exact substring match rarely survives real transcription wording.
  const queryWords = query.split(/\s+/);

  const scored = productNames
    .map((name) => {
      const lowerName = name.toLowerCase();
      const words = lowerName.split(/\s+/);
      if (queryWords.length > 1) {
        const allWordsHit = queryWords.every((qw) => words.some((w) => w.includes(qw) || wordsMatch(qw, w)));
        return allWordsHit ? { name, rank: 0 } : null;
      }
      const prefixHit = words.some((w) => w.startsWith(query));
      // Plural/singular hit ("laptops" <-> "Laptop") ranks just behind an
      // exact prefix hit but ahead of a loose substring match — it's a
      // confident match on the whole word, just not a literal one.
      const pluralHit = !prefixHit && words.some((w) => wordsMatch(query, w));
      const containsHit = !prefixHit && !pluralHit && lowerName.includes(query);
      if (!prefixHit && !pluralHit && !containsHit) return null;
      return { name, rank: prefixHit ? 0 : pluralHit ? 1 : 2 };
    })
    .filter((x): x is { name: string; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.name);
}

/** Replaces the trailing partial word at `cursor` with `replacement`,
 * returning the new text and the cursor position right after it. */
export function applySuggestion(
  text: string,
  cursor: number,
  partial: string,
  replacement: string,
): { text: string; cursor: number } {
  const start = cursor - partial.length;
  const before = text.slice(0, start);
  const after = text.slice(cursor);
  const newText = `${before}${replacement}${after}`;
  return { text: newText, cursor: before.length + replacement.length };
}
