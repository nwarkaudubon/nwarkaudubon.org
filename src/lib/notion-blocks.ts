// Renders Notion page content (blocks) to HTML.
// Supports the common text blocks. Anything else is skipped (images are skipped
// on purpose: Notion image URLs expire after an hour, so they would break).

type RichText = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

export type Block = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: Block[];
  [key: string]: any;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Only allow safe link targets.
const safeHref = (href: string | null) =>
  href && /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : null;

function renderRichText(items: RichText[] = []): string {
  return items
    .map((t) => {
      let html = escapeHtml(t.plain_text).replace(/\n/g, '<br />');
      const a = t.annotations;
      if (a.code) html = `<code>${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.underline) html = `<u>${html}</u>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      const href = safeHref(t.href);
      if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
      return html;
    })
    .join('');
}

const text = (block: Block) => renderRichText(block[block.type]?.rich_text);

export function renderBlocks(blocks: Block[]): string {
  let html = '';
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Group consecutive list items into one <ul> or <ol>.
    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      const tag = block.type === 'bulleted_list_item' ? 'ul' : 'ol';
      let items = '';
      while (i < blocks.length && blocks[i].type === block.type) {
        const li = blocks[i];
        items += `<li>${text(li)}${li.children ? renderBlocks(li.children) : ''}</li>`;
        i++;
      }
      html += `<${tag}>${items}</${tag}>`;
      continue;
    }

    switch (block.type) {
      case 'paragraph': {
        const inner = text(block);
        if (inner) html += `<p>${inner}</p>`;
        break;
      }
      // Page title is the h1, so Notion headings start at h2.
      case 'heading_1':
        html += `<h2>${text(block)}</h2>`;
        break;
      case 'heading_2':
        html += `<h3>${text(block)}</h3>`;
        break;
      case 'heading_3':
        html += `<h4>${text(block)}</h4>`;
        break;
      case 'quote':
        html += `<blockquote>${text(block)}</blockquote>`;
        break;
      case 'callout':
        html += `<div class="callout"><p>${text(block)}</p></div>`;
        break;
      case 'divider':
        html += '<hr />';
        break;
      case 'code':
        html += `<pre><code>${text(block)}</code></pre>`;
        break;
      case 'bookmark':
      case 'link_preview': {
        const url = safeHref(block[block.type]?.url);
        if (url) html += `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`;
        break;
      }
      default:
        // Unsupported block type (image, table, embed, ...): skipped.
        break;
    }
    i++;
  }

  return html;
}
