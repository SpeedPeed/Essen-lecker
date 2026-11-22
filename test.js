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
