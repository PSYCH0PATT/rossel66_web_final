const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function splitArtists(raw) {
  const s = normalize(raw).replace(/feat\.|ft\.|featuring/gi, ',');
  return s.split(/[,&]/).map(a => a.trim()).filter(Boolean);
}

function main() {
  const excelPath = path.join(process.cwd(), 'report.xlsx');
  const usersPath = path.join(process.cwd(), 'data', 'users.json');
  const releasesPath = path.join(process.cwd(), 'data', 'releases.json');

  if (!fs.existsSync(excelPath)) {
    console.error('report.xlsx not found in project root');
    process.exit(1);
  }

  const users = loadJson(usersPath, []);
  const releases = loadJson(releasesPath, []);

  const artistNameToId = new Map();
  for (const u of users) {
    if (u.role === 'artist') {
      artistNameToId.set(normalize(u.name), u.id);
      artistNameToId.set(normalize(u.username), u.id);
    }
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Columns per user's spec:
  // B: UPC (1), C: ISRC (2), D: Track Title (3), G: Album Title (6), H: Artist Names (7)
  const headerOffset = 1;

  // Index releases by composite: artistId + album title
  const index = new Map();
  for (const rel of releases) {
    const key = `${rel.artistId}__${normalize(rel.title)}`;
    index.set(key, rel);
  }

  let updates = 0;
  for (let i = headerOffset; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const upc = row[1];
    const isrc = row[2];
    const trackTitle = row[3];
    const albumTitle = row[6];
    const artistRaw = row[7];

    if (!trackTitle || !albumTitle || !artistRaw) continue;

    const mentioned = splitArtists(artistRaw);
    const mentionedIds = [];
    const mentionedNames = [];
    for (const name of mentioned) {
      const id = artistNameToId.get(name);
      if (id) mentionedIds.push(id); else mentionedNames.push(name);
    }

    if (mentionedIds.length <= 1) continue; // single artist -> nothing to feature

    // choose main artist as the one who owns the release in our dataset
    // find a release by any of the mentioned artist IDs + album title
    let release = null;
    for (const artistId of mentionedIds) {
      const key = `${artistId}__${normalize(albumTitle)}`;
      if (index.has(key)) {
        release = index.get(key);
        break;
      }
    }
    if (!release) continue;

    // set features for the specific track (match by ISRC or Title)
    for (const tr of release.tracks) {
      const titleMatch = normalize(tr.title) === normalize(trackTitle);
      const isrcMatch = isrc ? normalize(tr.isrc) === normalize(isrc) : false;
      if (titleMatch || isrcMatch) {
        const mainId = release.artistId;
        const features = mentionedIds.filter(id => id !== mainId);
        if (features.length || mentionedNames.length) {
          if (features.length) {
            tr.featuredArtistIds = Array.from(new Set([...(tr.featuredArtistIds || []), ...features]));
          }
          if (mentionedNames.length) {
            tr.featuredArtistNames = Array.from(new Set([...(tr.featuredArtistNames || []), ...mentionedNames]));
          }
          updates++;
        }
        break;
      }
    }
  }

  if (updates > 0) {
    saveJson(releasesPath, releases);
  }

  console.log(`Updated tracks with features: ${updates}`);
}

main();
