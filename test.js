// Selbsttest der Planungs-Engine: node test.js
const assert = require('assert');
const D = require('./data.js'), P = require('./planner.js');
const base = { store: 'hofer', adults: 2, kids: { on: false, count: 1, age: '4-10' }, meals: { lunch: false, dinner: true },
  budget: 40, styles: ['haus'], diet: 'none', dislikes: [], allergies: [], allergyMode: 'soft',
  equipment: ['kochfeld', 'ofen', 'mixer', 'mikrowelle'], fridge: true, freezer: true };

// Whole-Pack: 1 Portion Topfen (125 g) kostet einen ganzen 250-g-Becher
const wc = P.weekCost(['ofenerdaepfel'], D.RECIPES, { ...base, adults: 1, store: 'spar' });
assert.strictEqual(wc.items.find(i => i.id === 'topfen').packs, 1);
assert.ok(Math.abs(wc.items.find(i => i.id === 'topfen').cost - 1.19) < 1e-9);
assert.ok(!wc.items.find(i => i.id === 'oel').cost, 'Vorrat nicht bepreist');

for (const r of D.RECIPES) for (const id of Object.keys(r.ing)) assert.ok(D.INGREDIENTS[id], r.id + ':' + id);

const t = Date.now();
const plan = P.generate(base, D.RECIPES, new Date('2026-11-23'));
assert.strictEqual(plan.length, 7);
const cost = P.weekCost(plan.map(s => s.rid), D.RECIPES, base).total;
assert.ok(cost <= base.budget, 'Budget eingehalten: ' + cost.toFixed(2));

const vegan = P.generate({ ...base, diet: 'vegan', allergies: ['soy'], allergyMode: 'strict' }, D.RECIPES);
for (const s of vegan) { const f = P.flagsOf(D.RECIPES.find(r => r.id === s.rid)); assert.ok(!f.has('meat') && !f.has('dairy') && !f.has('soy') && !f.has('egg'), s.rid); }

const both = P.generate({ ...base, meals: { lunch: true, dinner: true }, budget: 70 }, D.RECIPES);
const rb = P.rebalance(both.map((s, i) => i === 3 ? { ...s, rid: 'slowgulasch' } : s), 3, { ...base, equipment: [...base.equipment, 'slowcooker'], meals: { lunch: true, dinner: true }, budget: 70 }, D.RECIPES);
assert.strictEqual(rb[3].rid, 'slowgulasch');
console.log('ok', cost.toFixed(2) + ' €', (Date.now() - t) + ' ms');

// Echte Preise: BILLA nutzt reale Packung, HOFER fällt auf Schätzung zurück
P.setPrices({ stores: { billa: { asOf: '2026-11-22', items: { topfen: { name: 'Clever Topfen 20%', price: 0.99, qty: 500 } } } } });
const tb = P.weekCost(['ofenerdaepfel'], D.RECIPES, { ...base, adults: 1, store: 'billa' }).items.find(i => i.id === 'topfen');
assert.deepStrictEqual([tb.packs, tb.cost, tb.pack, tb.product], [1, 0.99, '500 g', 'Clever Topfen 20%']);
assert.ok(!P.weekCost(['ofenerdaepfel'], D.RECIPES, { ...base, adults: 1 }).items.find(i => i.id === 'topfen').product);
P.setPrices(require('./prices.json'));
const real = P.generate({ ...base, store: 'billa' }, D.RECIPES);
console.log('ok echte Preise BILLA', P.weekCost(real.map(s => s.rid), D.RECIPES, { ...base, store: 'billa' }).total.toFixed(2) + ' €');

// Keine Doppelten: weder knappes Budget noch Mittag+Abend dürfen Rezepte wiederholen
for (const pr of [{ ...base, budget: 20 }, { ...base, meals: { lunch: true, dinner: true }, budget: 60 }, { ...base, store: 'billa', meals: { lunch: true, dinner: true }, budget: 300 }]) {
  for (let k = 0; k < 5; k++) { const ids = P.generate(pr, D.RECIPES).map(s => s.rid); assert.strictEqual(new Set(ids).size, ids.length, 'Doppelt: ' + ids); }
}
// Kleiner Pool (vegan + streng Soja/Gluten): Wiederholung erlaubt, aber gleichmäßig verteilt
const small = { ...base, diet: 'vegan', allergies: ['soy', 'gluten'], allergyMode: 'strict', meals: { lunch: true, dinner: true } };
const sp = P.generate(small, D.RECIPES).map(s => s.rid), max = Math.ceil(14 / D.RECIPES.filter(r => P.eligible(r, small)).length);
assert.ok(Object.values(sp.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {})).every(n => n <= max));
console.log('ok keine Doppelten');

// Aktionen: erkannt, gespart, bevorzugt
const { offerWas } = require('./scripts/prices.js');
assert.strictEqual(offerWas({ priceHistory: [{ date: '2026-11-19', price: 3.99 }, { date: '2026-10-01', price: 4.99 }] }, '2026-11-22'), 4.99);
assert.strictEqual(offerWas({ priceHistory: [{ date: '2026-10-19', price: 3.99 }, { date: '2026-10-01', price: 4.99 }] }, '2026-11-22'), null, 'zu alt');
assert.strictEqual(offerWas({ priceHistory: [{ date: '2026-11-19', price: 4.99 }, { date: '2026-10-01', price: 3.99 }] }, '2026-11-22'), null, 'teurer');
P.setPrices({ stores: { billa: { asOf: '2026-11-22', items: { faschiertes: { name: 'Clever Faschiertes', price: 3.99, qty: 500, was: 4.99 } } } } });
const bp = { ...base, store: 'billa', adults: 4 };
const fi = P.weekCost(['bolognese'], D.RECIPES, bp).items.find(i => i.id === 'faschiertes');
assert.ok(Math.abs(fi.saved - 1) < 1e-9 && P.offersIn(D.RECIPES.find(r => r.id === 'bolognese'), bp).length === 1);
assert.ok(P.prefScore(D.RECIPES.find(r => r.id === 'bolognese'), bp) > P.prefScore(D.RECIPES.find(r => r.id === 'bolognese'), base));
console.log('ok Aktionen');

// Flugblatt-Aktionen (marktguru): Packung über Grundpreis, Zuordnung, nur echte Ersparnis
const { matchOffers, packOfOffer } = require('./scripts/offers.js');
const { RULES } = require('./scripts/prices.js');
assert.deepStrictEqual(packOfOffer({ price: 4.99, referencePrice: 9.98, unit: { shortName: 'kg' } }), { unit: 'g', q: 500 });
const mk = (adv, name, price, ref, old, to = '2026-12-02') => ({ advertisers: [{ name: adv }], product: { name }, brand: { name: 'thisisnobrand123' }, price, referencePrice: ref, oldPrice: old, unit: { shortName: 'kg' }, validityDates: [{ from: '2026-11-18T00:00:00Z', to: to + 'T00:00:00Z' }] });
const reg = () => 6.99 / 500;
const m = matchOffers([mk('EUROSPAR', 'Gemischt Faschiertes', 4.99, 9.98, null), mk('HOFER', 'Faschiertes gemischt', 4.99, 9.98, null, '2026-11-20'),
  mk('Lidl', 'Gemischt Faschiertes', 7.99, 15.98, 8.49), mk('PENNY', 'Faschierte Laibchen gemischt', 2.99, 9.98, 3.99)], RULES, 'bio', reg, '2026-11-22');
assert.deepStrictEqual(Object.keys(m), ['spar'], 'abgelaufen (HOFER), teurer als Regal (Lidl), Laibchen (PENNY) ignoriert');
assert.strictEqual(m.spar.faschiertes.was, 6.99);
console.log('ok Flugblatt-Aktionen');

// Tage aussetzen: bleiben beim Neuplanen erhalten, feste Kochpause-Tage, keine Zutaten dafür
const wk = P.planWeek(base, D.RECIPES, [], new Date('2026-11-23T12:00')); // Montag
wk[2] = { ...wk[2], rid: null, skip: 'self', note: 'Omas Gulasch' };
const wk2 = P.planWeek(base, D.RECIPES, wk, new Date('2026-11-23T12:00'));
assert.deepStrictEqual([wk2[2].rid, wk2[2].skip, wk2[2].note], [null, 'self', 'Omas Gulasch']);
assert.ok(wk2.filter(s => s.rid).length === 6);
const fri = P.planWeek({ ...base, skipDays: [5] }, D.RECIPES, [], new Date('2026-11-23T12:00'));
assert.ok(fri.every(s => (new Date(s.date + 'T12:00').getDay() === 5) === (s.skip === 'self' && !s.rid)), 'Freitag ausgesetzt');
assert.strictEqual(D.RECIPES.length >= 55, true);
console.log('ok Aussetzen,', D.RECIPES.length, 'Rezepte');

// Abwechslung: höchstens 1 Süßspeise pro Woche, auch bei Mittag + Abend
for (let k = 0; k < 5; k++) {
  const w = P.generate({ ...base, meals: { lunch: true, dinner: true }, budget: 50 }, D.RECIPES);
  assert.ok(w.filter(s => D.RECIPES.find(r => r.id === s.rid).sweet).length <= 1, 'zu viel Süßes');
}
const t0 = Date.now(); P.generate({ ...base, meals: { lunch: true, dinner: true } }, D.RECIPES); console.log('ok Süßspeisen, 14 Slots in', Date.now() - t0, 'ms');

// Lokales Datum statt UTC: 0:30 Uhr Wiener Zeit ist noch derselbe Tag
assert.strictEqual(P.isoDay(new Date(2026, 10, 23, 0, 30)), '2026-11-23');
assert.strictEqual(P.planWeek(base, D.RECIPES, [], new Date(2026, 10, 23, 0, 30))[0].date, '2026-11-23');

// Knoblauch: 4 Zehen passen in ein 3er-Netz (~30 Zehen); echte Einzelknolle = 10 Zehen
P.setPrices({ stores: {} });
const garlic = { ...base, adults: 8 };
assert.strictEqual(P.weekCost(['ofenerdaepfel'], D.RECIPES, garlic).items.find(i => i.id === 'knoblauch').packs, 1);
P.setPrices({ stores: { spar: { asOf: '2026-09-10', items: { knoblauch: { name: 'Knoblauch frisch 1 STK', price: 1.23, qty: 1 } } } } });
const kn = P.packOf('knoblauch', { ...base, store: 'spar' });
assert.deepStrictEqual([kn.packQty, kn.pack], [10, '1 Knolle']);

// Reste-Slot und sein Vorabend-Gericht bleiben beim Ausgleichen stehen
P.setPrices(require('./prices.json'));
const lb = { ...base, meals: { lunch: true, dinner: true }, budget: 30 };
const wl = P.planWeek(lb, D.RECIPES, [], new Date('2026-11-23T12:00'));
wl[1] = { ...wl[1], rid: 'linseneintopf' }; wl[2] = { date: wl[2].date, meal: 'lunch', rid: 'linseneintopf', leftover: true };
const rl = P.rebalance(wl, -1, lb, D.RECIPES);
assert.deepStrictEqual([rl[1].rid, rl[2].rid, rl[2].leftover], ['linseneintopf', 'linseneintopf', true]);
console.log('ok Datum, Knoblauch, Reste');

// Flugblatt: Großpackung außerhalb der Regel-Spanne (Faschiertes 400–600 g) zählt nicht als Aktion
assert.deepStrictEqual(matchOffers([mk('Lidl', 'Faschiertes gemischt', 6.49, 6.49, 8.49)], RULES, 'bio', reg, '2026-11-22'), {});
console.log('ok Aktions-Packungsgröße');

// Rezeptdaten: Zutaten vorhanden, Nährwerte plausibel, Felder gültig, keine Doppelten
const recipeErrs = require('./scripts/check-recipes.js').check(D.RECIPES);
assert.deepStrictEqual(recipeErrs, [], recipeErrs.join('\n'));
console.log('ok Rezeptdaten,', D.RECIPES.length, 'Rezepte');

// Abwechslung am Tag: Mittag und Abend teilen selten eine Hauptzutat
let shared = 0;
for (let k = 0; k < 5; k++) {
  const w = P.generate({ ...base, store: 'billa', meals: { lunch: true, dinner: true }, budget: 80 }, D.RECIPES, new Date('2026-11-23T12:00'));
  for (let d = 0; d < w.length; d += 2) {
    const a = Object.keys(D.RECIPES.find(r => r.id === w[d].rid).ing), b = Object.keys(D.RECIPES.find(r => r.id === w[d + 1].rid).ing);
    shared += a.filter(id => b.includes(id) && !D.INGREDIENTS[id].flags.includes('pantry') && !['zwiebel', 'knoblauch', 'karotten', 'zitrone', 'petersilie', 'schnittlauch'].includes(id)).length;
  }
}
assert.ok(shared <= 10, 'zu viele gleiche Hauptzutaten am selben Tag: ' + shared);
console.log('ok Abwechslung am Tag (' + shared + ' geteilte Zutaten in 35 Tagen)');

// Rezeptfotos: jedes Foto gehört zu einem Rezept, liegt als Datei vor und hat einen Lizenznachweis
const fotos = JSON.parse(require('fs').readFileSync(__dirname + '/img/credits.json'));
for (const [id, c] of Object.entries(fotos)) {
  assert.ok(D.RECIPES.some(r => r.id === id), 'Foto ohne Rezept: ' + id);
  assert.ok(require('fs').existsSync(`${__dirname}/img/${id}.jpg`), 'Fotodatei fehlt: ' + id);
  assert.ok(c.source && /^(CC|Public Domain)/.test(c.license) && (c.creator || /^(CC0|Public Domain)/.test(c.license)), 'Nachweis unvollständig: ' + id); // BY/BY-SA brauchen Urheber
}
console.log('ok Rezeptfotos,', Object.keys(fotos).length, 'mit Nachweis');
