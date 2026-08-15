import { BarcodeDetector } from "barcode-detector/ponyfill";

/** Decodes a QR code out of a static image file — the "upload a photo"
 * fallback path, complementing the live webcam scan (<Scanner> from
 * @yudiel/react-qr-scanner in Receiving.tsx). Same underlying decoder
 * (BarcodeDetector, native if the browser has it, WASM zxing otherwise) so
 * both paths recognize identical QR codes with identical reliability.
 *
 * Returns the raw decoded text, or null if no QR code was found in the
 * image — a real, expected outcome for a blurry/off-frame photo, not an
 * error to throw. */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  const bitmap = await createImageBitmap(file);
  try {
    const results = await detector.detect(bitmap);
    return results[0]?.rawValue ?? null;
  } finally {
    bitmap.close();
  }
}

/** Reads a File as a data: URL — used to keep an optional photo record of a
 * scan (a webcam frame grab, or the uploaded image) alongside the decoded
 * payload, sent to the backend as ScanReceiptIn.imageDataUrl. */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
