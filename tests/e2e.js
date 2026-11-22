// Playwright-Smoke-Test: Onboarding → Plan → Tauschen/Aussetzen → Rezept/Kochmodus → Einkaufsliste → Profil.
// Aufruf: node tests/e2e.js [Screenshot-Ordner]   – meldet Konsolen-/Seitenfehler und bricht dann ab.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), SHOTS = process.argv[2];
// Barrierefreiheit: axe-core, falls installiert (CI: npm i axe-core) – jede Regelverletzung ist ein Fehler.
let AXE = null; try { AXE = require.resolve('axe-core/axe.min.js'); } catch { console.log('Hinweis: axe-core nicht installiert – A11y-Prüfung übersprungen'); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch(), errors = [];
  for (const [name, viewport] of [['mobil', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' }); // ohne Einblend-Animation (sonst misst axe Zwischenfarben)
    page.on('console', m => m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.route(/^https?:\/\/(?!localhost)/, r => r.abort()); // offline gegenüber Dritten
    const shot = async n => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}-${n}.png`), fullPage: true });
    const click = sel => page.locator(sel).first().click();
    const axe = async view => {
      if (!AXE) return;
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)));
      v.forEach(x => errors.push(`${name}/${view} A11y ${x}`));
    };
    await page.goto(url);

    // Onboarding
    await click('[data-a="store"][data-id="billa"]'); await shot('01-markt'); await axe('onboarding'); await click('[data-a="obnext"]');
    await click('[data-a="kids"]'); await click('[data-a="obnext"]');
    await click('[data-a="meal"][data-id="lunch"]'); await click('[data-a="obnext"]');
    await click('[data-a="obnext"]'); // Budget
    await click('[data-a="style"][data-id="haus"]'); await click('[data-a="obnext"]');
    await click('[data-a="obnext"]'); await click('[data-a="obnext"]'); await click('[data-a="obnext"]');
    await shot('02-kueche'); await click('[data-a="obnext"]');

    // Plan
    await page.waitForSelector('.card.day');
    const slots = await page.locator('.card.day').count();
    if (slots !== 14) errors.push(`${name}: ${slots} statt 14 Slots`);
    await shot('03-plan'); await axe('plan');
    const before = (await page.locator('.card.day h3').allTextContents()).join();
    await click('[data-a="regen"]'); await click('#toast [data-a="undo"]');
    if ((await page.locator('.card.day h3').allTextContents()).join() !== before) errors.push(`${name}: Rückgängig nach Neu planen`);

    // Tauschen (mit Suche) → Gericht wird fixiert
    await click('[data-a="swap"]'); await page.waitForSelector('.sheet'); await shot('04-tauschen'); await axe('tauschen');
    await page.fill('[data-i="sq"]', 'knödel'); await page.waitForTimeout(300); // Suche wartet kurz aufs Tippen
    if (!/knödel/i.test(await page.locator('#altlist .alt b').first().textContent())) errors.push(`${name}: Suche im Tausch-Fenster`);
    await click('.sheet [data-a="pick"]');
    if (!(await page.locator('.card.day .tag.pin').count())) errors.push(`${name}: getauschtes Gericht nicht fixiert`);
    // Aussetzen
    await page.locator('[data-a="swap"]').nth(1).click(); await page.fill('#selfnote', 'Omas Gulasch');
    await click('[data-a="skip"][data-id="self"]');
    if (!(await page.textContent('#app')).includes('Omas Gulasch')) errors.push(`${name}: Aussetzen fehlt`);

    // Rezept: Portionen, Einplanen, Kochmodus mit Zutaten
    await click('.card.day [data-a="recipe"]'); await page.waitForSelector('h1'); await shot('05-rezept'); await axe('rezept');
    await click('[data-a="serv"][data-d="1"]');
    if ((await page.textContent('.stepper.small b')).trim() !== '3') errors.push(`${name}: Portionen anpassen`);
    await click('[data-a="block"]');
    if (!(await page.textContent('#app')).includes('ausgeschlossen')) errors.push(`${name}: Nicht mehr vorschlagen`);
    await click('#toast [data-a="undoblock"]');
    if (!(await page.textContent('[data-a="block"]')).includes('Nicht mehr vorschlagen')) errors.push(`${name}: Ausschließen rückgängig`);
    await click('[data-a="planrecipe"]'); await click('.sheet [data-a="planat"]');
    if (await page.locator('.sheet').count()) errors.push(`${name}: Einplanen schließt nicht`);
    await click('[data-a="cook"]'); await page.waitForSelector('.cook');
    await click('[data-a="cooking"]'); if (!(await page.locator('.cooking .ing').count())) errors.push(`${name}: Zutaten im Kochmodus`);
    await click('.cook [data-a="cstep"][data-d="1"]'); await shot('06-kochmodus');
    // Zurück-Geste: Kochmodus → Rezept → Plan
    await page.goBack(); await page.waitForSelector('.photo.hero');
    if (await page.locator('.cook').count()) errors.push(`${name}: Zurück verlässt den Kochmodus nicht`);
    await click('[data-a="cook"]'); await page.waitForSelector('.cook');
    await click('.cook [data-a="exitcook"]'); await click('[data-a="go"][data-id="plan"]');

    // Einkaufsliste: abhaken + eigener Artikel; Fokus bleibt nach dem Neurendern erhalten
    await click('[data-a="go"][data-id="list"]'); await page.waitForSelector('.item');
    await page.locator('.item').first().focus(); await page.keyboard.press('Enter');
    if (!(await page.evaluate(() => document.activeElement?.matches('.item[aria-checked="true"]')))) errors.push(`${name}: Fokus nach Abhaken verloren`);
    await page.fill('[name="x"]', 'Kaffee'); await page.keyboard.press('Enter');
    if (!(await page.textContent('#app')).includes('Kaffee')) errors.push(`${name}: eigener Artikel fehlt`);
    await shot('07-liste'); await axe('liste');

    // Entdecken: große Sammlung seitenweise, Suche
    await click('[data-a="go"][data-id="plan"]'); await click('[data-a="go"][data-id="discover"]');
    const first = await page.locator('#dlist .card').count(); await click('[data-a="more"]');
    if (first !== 40 || (await page.locator('#dlist .card').count()) !== 80) errors.push(`${name}: „Mehr anzeigen“ kaputt (${first})`);
    await page.fill('[data-i="q"]', 'linsen'); await page.waitForTimeout(300);
    if (!(await page.locator('#dlist .card').count())) errors.push(`${name}: Suche ohne Treffer`);
    await page.fill('[data-i="q"]', ''); await page.waitForTimeout(300); await click('[data-a="cat"][data-id="Indisch"]'); await page.selectOption('[data-i="sort"]', 'zeit');
    const tags = await page.locator('#dlist .card .tag:not(.offer):not(.plan)').allTextContents();
    if (!tags.length || tags.some(t => t !== 'Indisch')) errors.push(`${name}: Kategorie-Filter (${tags.slice(0, 3)})`);

    // Profil
    await click('[data-a="go"][data-id="profile"]');
    await page.waitForSelector('[data-a="edit"]'); await shot('08-profil'); await axe('profil');
    await click('[data-a="edit"][data-i="3"]'); await click('[data-a="obnext"]');
    await page.waitForSelector('[data-a="edit"]');

    // Kaputter localStorage-Stand darf die App nicht leeren
    await page.evaluate(() => localStorage.setItem('piatto.v1', JSON.stringify({ onboarded: true, profile: { store: 'spar' }, plan: [null, { date: 'x' }] })));
    await page.goto(url); await page.waitForSelector('.card.day');
    await page.close();
  }
  await browser.close(); server.close();
  if (errors.length) { console.error('FEHLER:\n' + errors.join('\n')); process.exit(1); }
  console.log('ok e2e (mobil + desktop)');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
