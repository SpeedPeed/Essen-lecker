// Datenprüfung für Rezepte: node scripts/check-recipes.js [batch.js]  (ohne Argument: alle Rezepte aus data.js)
// Ein Batch exportiert ein Array von Rezepten im Format von data.js.
const D = require('../data.js');
const STYLES = new Set(D.STYLES.map(s => s[0])), EQUIP = new Set(D.EQUIPMENT.map(e => e[0]));
const CATS = new Set(['Hausmannskost', 'Wohlfühlessen', 'Familienliebling', 'Schnell', 'Kalorienarm', 'Gesundes Wohlfühlessen',
  'Eiweißreich', 'Lieferdienst selbst gemacht', 'Mediterran', 'Asiatisch inspiriert', 'Orientalisch', 'Mexikanisch', 'Balkan & Osteuropa',
  'Indisch', 'Salat & Bowl', 'Suppe & Eintopf', 'Süßspeise', 'Vegetarisch', 'Vegan']);

function check(recipes, existing = []) {
  const errs = [], ids = new Set(existing.map(r => r.id)), titles = new Set(existing.map(r => r.title.toLowerCase()));
  for (const r of recipes) {
    const e = m => errs.push(`${r.id || '?'}: ${m}`);
    if (!/^[a-z][a-zA-Z0-9]*$/.test(r.id || '')) e('id ungültig');
    if (ids.has(r.id)) e('id doppelt'); ids.add(r.id);
    if (titles.has((r.title || '').toLowerCase())) e('Titel doppelt'); titles.add((r.title || '').toLowerCase());
    if (!CATS.has(r.cat)) e('cat unbekannt: ' + r.cat);
    if (!(r.time >= 5 && r.time <= 480)) e('time');
    const timers = (r.steps || []).reduce((t, x) => t + (x.t || 0), 0);
    if (r.time < timers * 0.85) e(`time ${r.time} < Timer-Summe ${timers}`); // parallele Schritte erlaubt, aber nicht viel weniger
    if ((r.tags || []).includes('schnell') && r.time > 30) e('„schnell“ bei über 30 Min.');
    if (!(r.hue >= 0 && r.hue <= 360) || !r.emoji) e('hue/emoji');
    if (!Array.isArray(r.tags) || !r.tags.length || !r.tags.every(t => STYLES.has(t))) e('tags');
    if (!Array.isArray(r.needs) || !r.needs.every(n => EQUIP.has(n))) e('needs');
    if (!Array.isArray(r.m) || r.m.length !== 4 || !r.m.every(x => typeof x === 'number' && x >= 0)) e('m');
    else { const [k, p, c, f] = r.m, calc = 4 * p + 4 * c + 9 * f; if (k < 150 || k > 1300 || Math.abs(calc - k) / k > 0.2) e(`Nährwerte unplausibel (${k} kcal vs. ${calc} aus Makros)`); }
    const ing = Object.entries(r.ing || {});
    if (!ing.length) e('keine Zutaten');
    for (const [id, a] of ing) {
      const g = D.INGREDIENTS[id];
      if (!g) { e('Zutat unbekannt: ' + id); continue; }
      if (typeof a !== 'number' || a < 0) e('Menge ' + id);
      else if (!g.flags.includes('pantry') && a === 0) e('Menge 0 nur für Vorrat: ' + id);
      else if ((g.unit === 'g' || g.unit === 'ml') && a > 600) e('Menge pro Portion zu groß: ' + id);
    }
    if (!ing.some(([id]) => D.INGREDIENTS[id] && !D.INGREDIENTS[id].flags.includes('pantry'))) e('nur Vorrat');
    if (!Array.isArray(r.steps) || r.steps.length < 2 || !r.steps.every(s => typeof s.x === 'string' && s.x.length > 10 && (s.t === undefined || (s.t > 0 && s.t <= 480)))) e('steps');
  }
  return errs;
}
module.exports = { check, CATS };
if (require.main === module) {
  const path = require('path'), arg = process.argv[2];
  const errs = arg ? check(require(path.resolve(arg)), D.RECIPES) : check(D.RECIPES);
  console.log(errs.length ? errs.join('\n') : 'ok');
  process.exit(errs.length ? 1 : 0);
}
