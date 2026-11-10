// Shrink photos so the repo stays small. Usage:
//
//   npm run images:resize                  # everything in src/assets/banner/
//   npm run images:resize -- some/folder   # a different folder
//   npm run images:resize -- --size 1600   # a different max size (long edge, pixels)
//
// Photos whose long edge is already at or under the max are left untouched, so it's safe to
// run after adding a few new photos. Resized photos are rewritten in place: same filename and
// format, rotated upright, with camera metadata (including GPS location) removed.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
let maxSize = 1200;
let dir = 'src/assets/banner';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') maxSize = Number(args[++i]);
  else dir = args[i];
}
if (!Number.isFinite(maxSize) || maxSize < 100) {
  console.error('--size must be a number of pixels, e.g. --size 1200');
  process.exit(1);
}

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
if (files.length === 0) console.log(`No images found in ${dir}`);

let savedBytes = 0;
for (const file of files) {
  const full = path.join(dir, file);
  const input = await readFile(full);
  const { width, height } = await sharp(input).rotate().metadata(); // rotate() = apply EXIF orientation
  if (Math.max(width, height) <= maxSize) {
    console.log(`skip    ${file} (${width}x${height})`);
    continue;
  }

  const pipeline = sharp(input)
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') pipeline.png({ compressionLevel: 9 });
  else if (ext === '.webp') pipeline.webp({ quality: 82 });
  else pipeline.jpeg({ quality: 82, mozjpeg: true });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  if (data.length >= input.length) {
    console.log(`skip    ${file} (resized copy wasn't smaller)`);
    continue;
  }
  await writeFile(full, data);
  savedBytes += input.length - data.length;
  console.log(
    `resized ${file}: ${width}x${height} -> ${info.width}x${info.height}, ` +
      `${(input.length / 1024).toFixed(0)} KB -> ${(data.length / 1024).toFixed(0)} KB`,
  );
}
console.log(`Done. Saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB.`);
