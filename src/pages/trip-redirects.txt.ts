// Build helper, not a real page. Lists a redirect for every field trip so links keep working
// when a trip is renamed or rescheduled: "/field-trips/t42-<anything>" -> the trip's current
// page. The integration in astro.config.mjs moves these lines into dist/_redirects (the file
// Netlify reads) and deletes this output.
//
// Netlify only applies a rule when no real page exists at the requested address, so current
// links are served normally and only outdated ones are redirected.
import { getFieldTrips, idPrefix } from '../lib/notion';

export async function GET() {
  const trips = await getFieldTrips();
  const lines = trips
    .filter((t) => t.number !== null)
    .map((t) => `/field-trips/${idPrefix(t.number!)}-*  /field-trips/${t.slug}/  302`);
  return new Response(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain' } });
}
