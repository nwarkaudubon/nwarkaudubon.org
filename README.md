# nwarkaudubon.org

Website for the Northwest Arkansas Audubon Society. Built with [Astro](https://astro.build), hosted on Netlify, with field trip data from Notion.

## Develop

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # outputs to dist/
```

Pushing to `main` deploys automatically via Netlify.

## Images

- **Banner (fallback):** every page without a featured image shows a full-width row of photos in random order (reshuffled on each page load). Add photos by dropping `.jpg`/`.png`/`.webp` files into `src/assets/banner/`; delete a file to remove it. Any size works (resized at build time). Photos are never cropped by height: each is shown whole at the banner's height, and the row is centered on a neutral background. Add enough photos to fill most screen widths (about 8–12 typical-shaped photos covers a wide monitor); extras past the screen edge are clipped sideways. These are decorative and have no alt text.
- **Shrinking new photos:** run `npm run images:resize` after adding photos. It scales any photo over 1200px (long edge) down to 1200px in place, straightens it, and strips camera metadata including GPS; photos already small enough are skipped. Options: `npm run images:resize -- --size 1600` or `-- path/to/folder`.
- **Featured image:** add to a page's frontmatter (Markdown pages and `src/content/conservation/*.md`):

  ```yaml
  image: /images/conservation/example.jpg   # a file in public/
  imageAlt: "Describe what's in the photo"
  imageCredit: "Photo: Name"                 # optional
  ```

  Wide photos (roughly 3:1 to 2:1) work best; tall ones are cropped. Pages with a featured image don't show the banner. Pass `banner={false}` to `BaseLayout` to show neither.

Setup notes and architecture live in the NWAAS Obsidian vault ("Website Rebuild Plan", "Tech Stack & Accounts").
