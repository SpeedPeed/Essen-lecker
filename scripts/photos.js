// Rezeptfotos von Openverse (freie Lizenzen: CC BY, CC BY-SA, CC0, Public Domain).
//   node scripts/photos.js search <queries.json> <cache>   – eine Suche je Rezept ohne Foto (anonym: 20/min, 200/Tag)
//   node scripts/photos.js sheet  <cache> <id> [...]       – Kontaktbogen der Kandidaten → <cache>/sheets/<id>.jpg
//   node scripts/photos.js take   <cache> <picks.json>     – gewählte Bilder laden, auf 800×600 zuschneiden, Nachweis eintragen
// picks.json: { "rezeptId": Kandidatennummer, ... }  (Nummern wie auf dem Kontaktbogen)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const IMG = path.join(__dirname, '..', 'img'), UA = 'Piatto-Rezeptfotos/1.0';
const LIC = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Public Domain Mark' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(queriesFile, cache) {
  const queries = JSON.parse(fs.readFileSync(queriesFile)), credits = JSON.parse(fs.readFileSync(path.join(IMG, 'credits.json')));
  fs.mkdirSync(cache, { recursive: true });
  for (const [id, q] of Object.entries(queries)) {
    const file = path.join(cache, id + '.json');
    if (credits[id] || fs.existsSync(file)) continue;
    let r;
    for (let k = 0; k < 4; k++) { // Openverse antwortet gelegentlich mit 502/504
      r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&license=by,by-sa,cc0,pdm`, { headers: { 'user-agent': UA } }).catch(() => ({ status: 599, ok: false, headers: new Headers() }));
      if (r.status < 500) break;
      await sleep(5000 * (k + 1));
    }
    const left = +r.headers.get('x-ratelimit-available-anon_sustained');
    if (r.status === 429) { console.error('Tageskontingent erschöpft – morgen weitermachen'); break; }
    if (!r.ok) { console.error(id, 'HTTP', r.status); continue; }
    const res = (await r.json()).results.filter(x => (x.width || 999) >= 500).slice(0, 12)
      .map(x => ({ title: x.title, creator: x.creator, license: x.license, version: x.license_version, licenseUrl: x.license_url, source: x.foreign_landing_url, url: x.url }));
    fs.writeFileSync(file, JSON.stringify({ q, res }, null, 1));
    console.error(id, q, res.length, 'Treffer · noch', left, 'heute');
    if (left < 3) { console.error('Tageskontingent fast erschöpft – morgen weitermachen'); break; }
    await sleep(3200); // 20/min
  }
}

// Wikimedia liefert nur Standard-Thumbgrößen (250, 330, 500, 960, 1280 …), Originale sind oft riesig.
const wmThumb = (u, px) => /upload\.wikimedia\.org\/wikipedia\/commons\/(?!thumb)/.test(u) ? u.replace(/commons\/(.\/..\/)([^/]+)$/, `commons/thumb/$1$2/${px}px-$2`) : u;
// Kleine Vorschau statt Originalgröße: Flickr _m (240 px), Wikimedia 330 px.
const preview = u => /staticflickr\.com/.test(u) ? u.replace(/(_[a-z])?\.jpg$/, '_m.jpg') : wmThumb(u, 330);

async function download(url, file) {
  for (let k = 0; ; k++) { // Wikimedia drosselt die geteilte IP zeitweise mit 429
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    if (r.status !== 429 || k === 4) throw new Error('HTTP ' + r.status);
    await sleep(3000 * 2 ** k);
  }
}

async function sheet(cache, ids) {
  const dir = path.join(cache, 'prev'), out = path.join(cache, 'sheets');
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const { q, res } = JSON.parse(fs.readFileSync(path.join(cache, id + '.json'))), tiles = [];
    for (const [n, x] of res.entries()) {
      const f = path.join(dir, `${id}-${n}.jpg`);
      try { if (!fs.existsSync(f)) await download(preview(x.url), f); execFileSync('identify', [f], { stdio: 'ignore' }); tiles.push('-label', `${n}`, f); } catch { /* Bild fehlt */ }
    }
    if (!tiles.length) { console.log(id, 'keine Kandidaten'); continue; }
    execFileSync('montage', [...tiles, '-tile', '4x', '-geometry', '240x180+4+4', '-pointsize', '22', '-title', `${id}: ${q}`, path.join(out, id + '.jpg')]);
    console.log(path.join(out, id + '.jpg'));
  }
}

async function take(cache, picksFile) {
  const picks = JSON.parse(fs.readFileSync(picksFile)), credFile = path.join(IMG, 'credits.json'), credits = JSON.parse(fs.readFileSync(credFile));
  for (const [id, n] of Object.entries(picks)) {
    const x = JSON.parse(fs.readFileSync(path.join(cache, id + '.json'))).res[n], tmp = path.join(cache, id + '.orig');
    try {
      await download(wmThumb(x.url, 1280), tmp).catch(() => download(x.url, tmp)); // Thumb > Original gibt es nicht
      execFileSync('convert', [tmp, '-auto-orient', '-resize', '800x600^', '-gravity', 'center', '-extent', '800x600', '-strip', '-quality', '78', path.join(IMG, id + '.jpg')]);
      credits[id] = { title: x.title, creator: x.creator, license: `${LIC[x.license] || x.license.toUpperCase()} ${x.version}`.trim(), licenseUrl: x.licenseUrl, source: x.source };
      console.log('ok', id);
    } catch (e) { console.error('FEHLER', id, e.message); }
    await sleep(300);
  }
  fs.writeFileSync(credFile, JSON.stringify(credits, null, 1) + '\n');
}

const [cmd, a, ...rest] = process.argv.slice(2);
({ search: () => search(a, rest[0]), sheet: () => sheet(a, rest), take: () => take(a, rest[0]) })[cmd]?.().catch(e => { console.error(e); process.exit(1); })
  ?? console.error('Aufruf: search | sheet | take (siehe Kopfkommentar)');
