import sharp from "sharp";
import { readdirSync } from "fs";

const dir = process.argv[2];
const PAD = 132; // 66px design padding at 2x device scale

for (const file of readdirSync(dir).filter((f) => f.endsWith(".png")).sort()) {
  const path = `${dir}/${file}`;
  const img = sharp(path);
  const { width, height } = await img.metadata();

  // Greyscale raw pixels, one byte per pixel.
  const { data } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });

  let lastContentRow = 0;
  for (let y = height - 1; y >= 0; y--) {
    let hasInk = false;
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      if (data[rowStart + x] < 248) { hasInk = true; break; }
    }
    if (hasInk) { lastContentRow = y; break; }
  }

  const target = Math.min(height, lastContentRow + PAD);
  if (target >= height) { console.log(`${file}: no crop needed (${width}x${height})`); continue; }

  const buf = await sharp(path).extract({ left: 0, top: 0, width, height: target })
    .png({ compressionLevel: 9 }).toBuffer();
  await sharp(buf).toFile(path);
  console.log(`${file}: ${width}x${height} -> ${width}x${target}`);
}
