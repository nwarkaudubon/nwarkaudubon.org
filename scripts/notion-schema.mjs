// Prints the Field Trips database's properties so we can map them in code.
// Usage: npm run notion:schema                 (the Field Trips database)
//        npm run notion:schema -- <database-id>  (any other shared database)
// Reads NOTION_TOKEN and NOTION_FIELD_TRIPS_DB_ID from .env.

const token = process.env.NOTION_TOKEN;
const dbId = process.argv[2] ?? process.env.NOTION_FIELD_TRIPS_DB_ID;

if (!token || !dbId) {
  console.error('Missing NOTION_TOKEN or NOTION_FIELD_TRIPS_DB_ID. Add them to .env first.');
  process.exit(1);
}

const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
  },
});

if (!res.ok) {
  console.error(`Notion returned ${res.status}: ${await res.text()}`);
  console.error('Check the token, the database ID, and that the database is shared with the connection.');
  process.exit(1);
}

const db = await res.json();
console.log(`Database: ${db.title?.map((t) => t.plain_text).join('') || '(untitled)'}\n`);

for (const [name, prop] of Object.entries(db.properties)) {
  let detail = '';
  const options = prop.select?.options ?? prop.status?.options ?? prop.multi_select?.options;
  if (options) detail = ` [${options.map((o) => o.name).join(', ')}]`;
  if (prop.type === 'relation') detail = ` -> database ${prop.relation?.database_id}`;
  console.log(`- ${name}: ${prop.type}${detail}`);
}
