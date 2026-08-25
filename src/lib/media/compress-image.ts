import sharp from "sharp";

/**
 * Downscales + re-encodes an uploaded image to a bounded JPEG before it is
 * stored or sent to Gemini. Keeps requests fast, storage small, and image
 * tokens low — part of the free-tier conservation strategy.
 */
export async function compressImageBase64(
  base64: string,
  _mimeType: string
): Promise<{ base64: string; width: number | null; height: number | null }> {
  const buffer = Buffer.from(base64, "base64");
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();

  const MAX_DIM = 1600;
  const resized = image.resize({
    width: MAX_DIM,
    height: MAX_DIM,
    fit: "inside",
    withoutEnlargement: true,
  });

  const output = await resized.jpeg({ quality: 82 }).toBuffer();
  return {
    base64: output.toString("base64"),
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}
