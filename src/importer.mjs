// Bring bookmarks over from Chrome or Edge on this PC. Nothing is synced or sent
// anywhere: Weber reads the other browser's local Bookmarks file, and only when you
// pick a source and confirm. Passwords and cookies are never read.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const LOCAL = process.env.LOCALAPPDATA ?? '';
const BROWSERS = [
  { id: 'chrome', name: 'Google Chrome', dir: path.join(LOCAL, 'Google', 'Chrome', 'User Data') },
  { id: 'edge', name: 'Microsoft Edge', dir: path.join(LOCAL, 'Microsoft', 'Edge', 'User Data') },
  { id: 'brave', name: 'Brave', dir: path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data') },
];

/** Which browsers and profiles have a bookmarks file (names only; nothing is read yet). */
export function importSources() {
  const out = [];
  for (const b of BROWSERS) {
    let names = [];
    try {
      names = fs.readdirSync(b.dir).filter((d) => d === 'Default' || /^Profile \d+$/.test(d));
    } catch {
      continue;
    }
    let labels = {};
    try {
      labels = JSON.parse(fs.readFileSync(path.join(b.dir, 'Local State'), 'utf8')).profile?.info_cache ?? {};
    } catch {}
    for (const p of names)
      if (fs.existsSync(path.join(b.dir, p, 'Bookmarks')))
        out.push({ id: `${b.id}:${p}`, browser: b.name, profile: labels[p]?.name || (p === 'Default' ? 'Default profile' : p) });
  }
  return out;
}

/** Bookmarks from one source as flat { url, title, folder } rows, folders as "Imported from Chrome/Work/…". */
export async function readBookmarks(sourceId, file) {
  let label = 'Imported';
  if (!file) {
    const [bid, profile] = String(sourceId).split(':');
    const b = BROWSERS.find((x) => x.id === bid);
    if (!b || !/^(Default|Profile \d+)$/.test(profile ?? '')) throw new Error('Unknown source');
    file = path.join(b.dir, profile, 'Bookmarks');
    label = `Imported from ${b.name.split(' ').pop()}`;
  }
  const j = JSON.parse(await fsp.readFile(file, 'utf8'));
  const rows = [];
  // keep the folder structure: bar items go under "<label>", other folders nest beneath it
  const visit = (node, folder) => {
    for (const c of node?.children ?? []) {
      if (c.type === 'url') {
        if (/^https?:\/\//i.test(c.url ?? '')) rows.push({ url: c.url, title: String(c.name || c.url).slice(0, 300), folder });
      } else if (c.type === 'folder') visit(c, `${folder}/${String(c.name || 'Folder').replace(/\//g, '-').slice(0, 60)}`);
    }
  };
  visit(j.roots?.bookmark_bar, label);
  visit(j.roots?.other, `${label}/Other bookmarks`);
  visit(j.roots?.synced, `${label}/Mobile bookmarks`);
  return rows;
}
