// Copies images from Notion onto our own site at build time.
//
// Notion's image links expire after about an hour, so the site can't link to them directly.
// Instead each image is downloaded, resized, converted to WebP and saved with a name based on
// its contents. The page then points at our copy (/trip-images/<name>.webp).
//
//   Build: files go to .trip-images/ and the hook in astro.config.mjs copies them into dist/.
//   Dev:   files go to public/trip-images/ so the dev server can serve them.
// Both folders are git-ignored. A failed download never breaks the build: the image is skipped.

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve(import.meta.env.DEV ? 'public/trip-images' : '.trip-images');
const MAX_BYTES = 25 * 1024 * 1024;

export interface SavedImage {
  /** Public path of the main version, e.g. /trip-images/ab12cd34ef56-1200.webp */
  src: string;
  width: number;
  height: number;
  /** A larger version, if the original was bigger than the main one. */
  fullSrc?: string;
  /** Small 4:3 thumbnail, if requested. */
  thumbSrc?: string;
}

export interface SaveOptions {
  /** Max width of the main version (never enlarged). */
  width: number;
  /** Also save a larger version up to this width, if the original is that big. */
  fullWidth?: number;
  /** Also save a cropped thumbnail of this size (centered). */
  thumb?: { width: number; height: number };
}

let prepared = false;
const done = new Map<string, Promise<SavedImage | null>>();

function prepare() {
  if (prepared) return;
  prepared = true;
  // Build: start clean so removed images don't pile up. Dev: leave the folder alone.
  if (!import.meta.env.DEV) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
}

/** Downloads `url` and saves the resized copies. Returns null (with a warning) on any failure. */
export function saveImage(url: string, opts: SaveOptions): Promise<SavedImage | null> {
  const key = `${url}|${JSON.stringify(opts)}`;
  if (!done.has(key)) done.set(key, doSave(url, opts));
  return done.get(key)!;
}

async function doSave(url: string, opts: SaveOptions): Promise<SavedImage | null> {
  try {
    if (!/^https?:\/\//i.test(url)) throw new Error('not an http(s) link');
    prepare();

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('not an image');
    const source = Buffer.from(await res.arrayBuffer());
    if (source.length > MAX_BYTES) throw new Error('file is over 25 MB');

    const id = createHash('sha1').update(source).digest('hex').slice(0, 12);
    const meta = await sharp(source).rotate().metadata();
    const srcWidth = meta.width ?? opts.width;

    const write = async (suffix: string, pipeline: sharp.Sharp) => {
      const name = `${id}-${suffix}.webp`;
      const file = path.join(OUT_DIR, name);
      const info = await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      if (!existsSync(file)) writeFileSync(file, info.data);
      return { src: `/trip-images/${name}`, width: info.info.width, height: info.info.height };
    };
    const resized = (width: number) =>
      sharp(source).rotate().resize({ width, withoutEnlargement: true });

    const main = await write(String(Math.min(opts.width, srcWidth)), resized(opts.width));
    const result: SavedImage = { ...main };

    if (opts.fullWidth && srcWidth > opts.width) {
      result.fullSrc = (await write(String(Math.min(opts.fullWidth, srcWidth)), resized(opts.fullWidth))).src;
    }
    if (opts.thumb) {
      const { width, height } = opts.thumb;
      result.thumbSrc = (
        await write(`thumb-${width}x${height}`, sharp(source).rotate().resize(width, height, { fit: 'cover', position: 'centre' }))
      ).src;
    }
    return result;
  } catch (err) {
    console.warn(`[notion] Skipped an image (${(err as Error).message}).`);
    return null;
  }
}
