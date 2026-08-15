"""Generates a synthetic invoice image for OCR testing/development, mirroring
the frontend's mock invoice content (INV-8821 / PO-4501 / Meridian Office
Supply Co.) so extraction results can be sanity-checked against known values.

Usage:
    python scripts/generate_test_invoice.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT_PATH = Path(__file__).parent / "test_invoice.png"

WIDTH, HEIGHT = 1000, 1300


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in ["arial.ttf", "C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(img)

    title_font = load_font(36)
    label_font = load_font(20)
    body_font = load_font(24)

    y = 60
    draw.text((60, y), "Meridian Office Supply Co.", font=title_font, fill="black")
    y += 60
    draw.text((60, y), "220 Industrial Estate Rd, Chennai, TN 600058, IN", font=label_font, fill="gray")

    draw.text((650, 60), "INVOICE", font=title_font, fill="black")
    draw.text((650, 110), "Invoice #: INV-8821", font=body_font, fill="black")
    draw.text((650, 145), "PO Reference: PO-4501", font=body_font, fill="black")

    y = 250
    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((60, y), "Vendor: Meridian Office Supply Co.", font=body_font, fill="black")
    y += 60

    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((60, y), "Description", font=label_font, fill="gray")
    draw.text((450, y), "Quantity", font=label_font, fill="gray")
    draw.text((600, y), "Unit Price", font=label_font, fill="gray")
    draw.text((780, y), "Total", font=label_font, fill="gray")
    y += 40
    draw.text((60, y), "Ergonomic Office Chair", font=body_font, fill="black")
    draw.text((450, y), "45 units", font=body_font, fill="black")
    draw.text((600, y), "$370.00", font=body_font, fill="black")
    draw.text((780, y), "$16,650.00", font=body_font, fill="black")

    y += 80
    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((700, y), "Total: $16,650.00", font=title_font, fill="black")

    img.save(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
