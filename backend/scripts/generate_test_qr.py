"""Generates test QR-coded packing slips for the Receiving flow, since there
are no real warehouse goods to photograph (see plan section 1). Each QR code
encodes {"poNumber": ..., "quantity": ...} as JSON, decoded server-side by
ScanService (app/services/scan.py) via pyzbar.

Usage:
    python scripts/generate_test_qr.py

Produces PNGs in backend/scripts/test_qr/ for both a matching-quantity case
and a mismatched-quantity case, so both branches of the receiving-verification
logic have something real to test and demo against.
"""

import json
from pathlib import Path

import qrcode

OUTPUT_DIR = Path(__file__).parent / "test_qr"

TEST_CASES = [
    {"filename": "po-4501-match.png", "poNumber": "PO-4501", "quantity": 50},
    {"filename": "po-4501-mismatch.png", "poNumber": "PO-4501", "quantity": 45},
    {"filename": "po-4498-match.png", "poNumber": "PO-4498", "quantity": 120},
    {"filename": "po-4507-match.png", "poNumber": "PO-4507", "quantity": 64},
    {"filename": "po-4507-mismatch.png", "poNumber": "PO-4507", "quantity": 50},
]


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    for case in TEST_CASES:
        payload = json.dumps({"poNumber": case["poNumber"], "quantity": case["quantity"]})
        img = qrcode.make(payload)
        out_path = OUTPUT_DIR / case["filename"]
        img.save(out_path)
        print(f"Wrote {out_path} -> {payload}")


if __name__ == "__main__":
    main()
