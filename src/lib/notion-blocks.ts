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

/** One row of an inline database (a series' outing schedule), already resolved to plain data. */
export interface ScheduleRow {
  title: string;
  /** Notion date string from the Date column, e.g. "2026-10-21T07:00:00.000-05:00". */
  start: string;
  /** e.g. "Wednesday, October 21 at 7:00 AM" (built from the Date column). */
  when: string;
  leaders: { name: string }[];
  status: string;
  /** The day's eBird checklist. */
  checklistUrl?: string;
  /** Sharing link that copies the checklist into the visitor's own eBird account. */
  joinUrl?: string;
}

export interface Schedule {
  rows: ScheduleRow[];
}

/**
 * The outing schedule as a table. On narrow screens CSS stacks each row into a card, using the
 * data-label attributes as captions.
 */
function renderSchedule(s: Schedule): string {
  const hasLeaders = s.rows.some((r) => r.leaders.length > 0);
  const hasStatus = s.rows.some((r) => r.status);
  const hasLinks = s.rows.some((r) => safeHref(r.checklistUrl ?? null) || safeHref(r.joinUrl ?? null));
  const head =
    '<th scope="col">Outing</th>' +
    (hasLeaders ? '<th scope="col">Leader</th>' : '') +
    (hasStatus ? '<th scope="col">Status</th>' : '') +
    (hasLinks ? '<th scope="col">eBird Checklist</th>' : '');

  const body = s.rows
    .map((r) => {
      // Names only: contact info is in the trip leaders' section at the bottom of the page.
      const leaders = r.leaders.map((l) => escapeHtml(l.name)).join('<br />');
      const status = r.status
        ? `<span class="badge badge-${escapeHtml(r.status.toLowerCase().replace(/[^a-z]+/g, '-'))}">${escapeHtml(r.status)}</span>`
        : '';
      // "View" opens the day's checklist; "Join" is a share link that copies it into the
      // visitor's own eBird account. Full descriptions are for screen readers.
      const view = safeHref(r.checklistUrl ?? null);
      const join = safeHref(r.joinUrl ?? null);
      const title = escapeHtml(r.title);
      const links = hasLinks
        ? `<td data-label="eBird Checklist">${
            view || join
              ? '<span class="schedule-links">' +
                (view ? `<a href="${escapeHtml(view)}" aria-label="View the eBird checklist for ${title}">View</a>` : '') +
                (join ? `<a class="button button-small" href="${escapeHtml(join)}" aria-label="Join the eBird checklist for ${title}">Join</a>` : '') +
                '</span>'
              : ''
          }</td>`
        : '';
      return (
        `<tr><th scope="row"><strong>${escapeHtml(r.title)}</strong><br />${escapeHtml(r.when)}</th>` +
        (hasLeaders ? `<td data-label="Leader">${leaders}</td>` : '') +
        (hasStatus ? `<td data-label="Status">${status}</td>` : '') +
        `${links}</tr>`
      );
    })
    .join('');

  return `<table class="schedule"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

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
      case 'child_database':
        // An inline database in the page (a series' outing schedule); see loadSchedule().
        if (block.schedule?.rows.length) html += renderSchedule(block.schedule);
        break;
      default:
        // Unsupported block type (image, table, embed, ...): skipped.
        break;
    }
    i++;
  }

  return html;
}
