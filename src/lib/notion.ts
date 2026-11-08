// Fetches field trips from the Notion database at build time.
// Needs NOTION_TOKEN and NOTION_FIELD_TRIPS_DB_ID (see .env.example).

import { renderBlocks, type Block } from './notion-blocks';

const NOTION_BASE = import.meta.env.NOTION_API_BASE ?? 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const TIME_ZONE = 'America/Chicago';

/** Only trips with one of these Status values are ever published. */
const PUBLIC_STATUSES = ['Announced', 'Full', 'Postponed', 'Canceled', 'Completed'] as const;
export type TripStatus = (typeof PUBLIC_STATUSES)[number];

export interface FieldTrip {
  id: string;
  slug: string;
  name: string;
  status: TripStatus;
  /** Notion date strings: "2026-06-06" or "2026-06-06T08:00:00.000-05:00" */
  start: string;
  end: string | null;
  location: string;
  county: string;
  coordinates: string;
  mapUrl: string | null;
  checklistUrl: string | null;
  participants: number | null;
  limit: number | null;
  isPast: boolean;
}

// ---------- API ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function notion(path: string, init: RequestInit = {}): Promise<any> {
  const token = import.meta.env.NOTION_TOKEN;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${NOTION_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get('retry-after') ?? 1) * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Notion API ${res.status} for ${path}: ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error(`Notion API rate limit: gave up on ${path} after 5 retries`);
}

// ---------- Property helpers ----------

const plain = (items: { plain_text: string }[] = []) => items.map((t) => t.plain_text).join('');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Today's date (YYYY-MM-DD) in Arkansas. */
const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());

function pageToTrip(page: any): FieldTrip | null {
  const p = page.properties;
  const name = plain(p.Name?.title).trim();
  const start: string | undefined = p.Date?.date?.start;
  const status: TripStatus | undefined = p.Status?.status?.name;

  // The query already filters by status; check again so drafts can never leak.
  if (!status || !PUBLIC_STATUSES.includes(status)) return null;

  if (!name || !start) {
    console.warn(`[notion] Skipping "${name || page.id}": needs Name and Date.`);
    return null;
  }

  const end: string | null = p.Date.date.end ?? null;
  const lastDay = (end ?? start).slice(0, 10);
  const datePassed = lastDay < todayLocal();

  return {
    id: page.id,
    slug: `${slugify(name)}-${start.slice(0, 10)}`,
    name,
    status,
    start,
    end,
    location: plain(p.Location?.rich_text).trim(),
    county: plain(p.County?.rich_text).trim(),
    coordinates: plain(p.Coordinates?.rich_text).trim(),
    mapUrl: p['Map link']?.url ?? null,
    checklistUrl: p.Checklist?.url ?? null,
    participants: p.Participants?.number ?? null,
    limit: p['Participant limit']?.number ?? null,
    isPast: status === 'Completed' || datePassed,
  };
}

// ---------- Public API ----------

let cache: Promise<FieldTrip[]> | undefined;

/** All publishable trips. Upcoming first (soonest first), then past (most recent first). */
export function getFieldTrips(): Promise<FieldTrip[]> {
  cache ??= loadFieldTrips();
  return cache;
}

async function loadFieldTrips(): Promise<FieldTrip[]> {
  const token = import.meta.env.NOTION_TOKEN;
  const dbId = import.meta.env.NOTION_FIELD_TRIPS_DB_ID;

  if (!token || !dbId) {
    const msg = 'NOTION_TOKEN and NOTION_FIELD_TRIPS_DB_ID must be set (see .env.example).';
    if (import.meta.env.PROD) throw new Error(msg);
    console.warn(`[notion] ${msg} Showing no field trips.`);
    return [];
  }

  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const data = await notion(`/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          or: PUBLIC_STATUSES.map((s) => ({ property: 'Status', status: { equals: s } })),
        },
        sorts: [{ property: 'Date', direction: 'ascending' }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const trips = pages
    .map(pageToTrip)
    .filter((t): t is FieldTrip => t !== null)
    // A postponed/canceled trip whose date has passed has served its purpose.
    .filter((t) => !(t.isPast && (t.status === 'Postponed' || t.status === 'Canceled')));

  const upcoming = trips.filter((t) => !t.isPast).sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.isPast).sort((a, b) => b.start.localeCompare(a.start));
  return [...upcoming, ...past];
}

export const getUpcomingTrips = async () => (await getFieldTrips()).filter((t) => !t.isPast);
export const getPastTrips = async () => (await getFieldTrips()).filter((t) => t.isPast);

/** Renders the body of a trip's Notion page to HTML. */
export async function getTripBodyHtml(pageId: string): Promise<string> {
  return renderBlocks(await fetchBlocks(pageId));
}

async function fetchBlocks(blockId: string): Promise<Block[]> {
  const blocks: Block[] = [];
  let cursor: string | undefined;
  do {
    const data = await notion(
      `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
    );
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  for (const block of blocks) {
    if (block.has_children) block.children = await fetchBlocks(block.id);
  }
  return blocks;
}

// ---------- Display helpers ----------

const parseDateOnly = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const fmtDay = (s: string, opts: Intl.DateTimeFormatOptions) =>
  s.length > 10
    ? new Date(s).toLocaleDateString('en-US', { ...opts, timeZone: TIME_ZONE })
    : parseDateOnly(s).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });

/** "Saturday, June 6, 2026 at 8:00 AM" or "Friday, April 25 – Sunday, April 27, 2025" */
export function formatTripDate(trip: Pick<FieldTrip, 'start' | 'end'>): string {
  const full: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const { start, end } = trip;
  const sameDay = !end || end.slice(0, 10) === start.slice(0, 10);

  if (sameDay) {
    const time = start.length > 10 ? ` at ${fmtTime(start)}` : '';
    return `${fmtDay(start, full)}${time}`;
  }
  return `${fmtDay(start, { ...full, year: undefined })} – ${fmtDay(end, full)}`;
}

/** Spots left for an open trip, or null when there is no limit. */
export function spotsLeft(trip: FieldTrip): number | null {
  if (trip.limit == null) return null;
  return Math.max(0, trip.limit - (trip.participants ?? 0));
}
