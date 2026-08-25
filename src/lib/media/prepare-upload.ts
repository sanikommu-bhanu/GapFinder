"use client";

/**
 * Prepares a photo in the browser before it is uploaded.
 *
 * Doing this client-side fixes several problems at once. Modern phone cameras
 * produce 4-12 MB files, which used to be rejected outright by the size guard;
 * iPhones produce HEIC, which the server's image pipeline may not decode; and
 * uploading full-resolution photos over mobile data is slow for no benefit,
 * since the vision model gets a downscaled copy either way.
 *
 * Re-encoding through a canvas normalises all of that to a bounded JPEG. The
 * browser decodes whatever format it can display — including HEIC on iOS — so
 * the server only ever receives one predictable format.
 *
 * If the browser can't decode the file, the original bytes are sent unchanged
 * and the server decides. Refusing to upload would be worse than trying.
 */

/** Enough resolution for handwriting; beyond this adds tokens, not legibility. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  base64: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  /** True when the browser re-encoded it; false when raw bytes are being sent. */
  compressed: boolean;
  originalBytes: number;
  uploadBytes: number;
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;

  try {
    const bitmap = await decode(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");

    // White ground: a transparent PNG flattened onto black would hide pencil.
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) throw new Error("encode failed");

    return {
      base64: await blobToBase64(blob),
      mimeType: "image/jpeg",
      width,
      height,
      compressed: true,
      originalBytes,
      uploadBytes: blob.size,
    };
  } catch {
    // Undecodable here — hand the original to the server rather than refusing.
    const base64 = await blobToBase64(file);
    return {
      base64,
      mimeType: file.type || "image/jpeg",
      width: null,
      height: null,
      compressed: false,
      originalBytes,
      uploadBytes: originalBytes,
    };
  }
}

/**
 * `createImageBitmap` applies EXIF orientation where supported, so a photo
 * taken sideways doesn't reach the model rotated.
 */
async function decode(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      return await createImageBitmap(file);
    }
  }
  throw new Error("createImageBitmap unavailable");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) reject(new Error("empty read"));
      else resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/** For the preview, without a second read of the file. */
export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}
