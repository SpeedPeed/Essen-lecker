// Piatto – Planungs-Engine (rein, ohne DOM). Läuft im Browser und in Node (test.js).
(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.PIATTO_DATA;
  const KID_FACTOR = { '1-3': 0.3, '4-10': 0.5, '11-17': 0.8 };

  const servings = p => p.adults + (p.kids.on ? p.kids.count * KID_FACTOR[p.kids.age] : 0);
  const store = p => D.STORES.find(s => s.id === p.store) || D.STORES[1];
  const flagsOf = r => new Set(Object.keys(r.ing).flatMap(id => (D.INGREDIENTS[id] || { flags: [] }).flags));

  function dietOk(flags, diet) {
    if (diet === 'vegan') return !['meat', 'fish', 'seafood', 'dairy', 'egg'].some(f => flags.has(f));
    if (diet === 'vegetarisch') return !['meat', 'fish', 'seafood'].some(f => flags.has(f));
    if (diet === 'pescetarisch') return !flags.has('meat');
    return true;
  }

  // Harte Filter: Ernährung, Abneigungen, strenge Allergien, fehlende Geräte.
  function eligible(r, p) {
    const f = flagsOf(r);
    if (!dietOk(f, p.diet)) return false;
    if (p.dislikes.some(d => f.has(d))) return false;
    if (p.allergyMode === 'strict' && p.allergies.some(a => f.has(a))) return false;
    return r.needs.every(n => p.equipment.includes(n));
  }

  function prefScore(r, p) {
    const f = flagsOf(r);
    let s = r.tags.filter(t => p.styles.includes(t)).length * 2;
    if (p.allergyMode !== 'strict') s -= p.allergies.filter(a => f.has(a)).length * 4; // Soft-Filter
    return s;
  }

  // Echte Packung (prices.json von heisse-preise.io) oder Schätzung über den Preisfaktor des Markts.
  let PRICES = null;
  const setPrices = j => { PRICES = j; };
  const realStore = p => PRICES && PRICES.stores[p.store];
  function packOf(id, p) {
    const ing = D.INGREDIENTS[id], real = realStore(p) && realStore(p).items[id];
    if (!real) return { packQty: ing.packQty, price: ing.price * store(p).priceFactor, pack: ing.pack, product: null };
    const metric = ing.unit === 'g' || ing.unit === 'ml';
    // Bei Kopf/Bund/Zehe usw. gilt 1 echtes Stück = 1 unserer Packungen.
    const packQty = metric || ing.unit === 'Stk' ? real.qty : ing.packQty;
    return { packQty, price: real.price, pack: metric ? (real.qty >= 1000 ? (real.qty / 1000).toLocaleString('de-AT') + (ing.unit === 'g' ? ' kg' : ' l') : real.qty + ' ' + ing.unit) : (ing.unit === 'Stk' ? real.qty + ' Stk' : ing.pack), product: real.name };
  }

  // Whole-Pack Costing: Wochenmenge je Zutat → ganze Packungen. Basisvorrat wird nicht gerechnet.
  function weekCost(rids, recipes, p) {
    const sv = servings(p), need = {};
    for (const rid of rids) {
      const r = rid && recipes.find(x => x.id === rid);
      if (!r) continue;
      for (const [id, amt] of Object.entries(r.ing)) need[id] = (need[id] || 0) + amt * sv;
    }
    let total = 0;
    const items = Object.entries(need).map(([id, qty]) => {
      const ing = D.INGREDIENTS[id];
      const pantry = ing.flags.includes('pantry'), pk = packOf(id, p);
      const packs = pantry ? 0 : Math.max(1, Math.ceil(qty / pk.packQty - 1e-9));
      const cost = packs * pk.price;
      total += cost;
      return { id, ing, qty, packs, cost, pantry, leftover: packs * pk.packQty - qty, pack: pk.pack, product: pk.product };
    });
    return { total, items };
  }

  // Anteilspreis eines Gerichts (anteilig nach Menge, nicht nach Packung).
  function shareCost(r, p) {
    const sv = servings(p);
    return Object.entries(r.ing).reduce((s, [id, amt]) => {
      if (D.INGREDIENTS[id].flags.includes('pantry')) return s;
      const pk = packOf(id, p);
      return s + (amt * sv / pk.packQty) * pk.price;
    }, 0);
  }

  function slotsFor(p, start) {
    const out = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(date.getDate() + d);
      const iso = date.toISOString().slice(0, 10);
      if (p.meals.lunch) out.push({ date: iso, meal: 'lunch', rid: null });
      if (p.meals.dinner) out.push({ date: iso, meal: 'dinner', rid: null });
    }
    return out;
  }

  // Greedy mit Zufallsrauschen, mehrere Durchläufe: bestes Ergebnis innerhalb des Budgets gewinnt.
  function generate(p, recipes, start = new Date(), locked = null, rand = Math.random) {
    const base = locked || slotsFor(p, start);
    const pool = recipes.filter(r => eligible(r, p));
    if (!pool.length) return base.map(s => ({ ...s, rid: s.locked ? s.rid : null }));
    // Jedes Rezept max. 1× pro Woche – mehr nur, wenn die Filter zu wenige Rezepte übrig lassen.
    const maxUses = Math.ceil(base.length / pool.length);
    let best = null;
    for (let iter = 0; iter < 60; iter++) {
      const costW = 0.5 + (iter / 60) * 4;
      const plan = base.map(s => ({ ...s, rid: s.locked ? s.rid : null }));
      for (const slot of plan) {
        if (slot.locked) continue;
        const cur = plan.map(s => s.rid).filter(Boolean);
        const curCost = weekCost(cur, recipes, p).total;
        const open = p.fridge !== false ? weekCost(cur, recipes, p).items.filter(i => i.leftover > 0 && !i.pantry).map(i => i.id) : [];
        let pick = null, pickScore = -Infinity;
        for (const r of pool) {
          const uses = cur.filter(x => x === r.id).length;
          if (uses >= maxUses) continue;
          const marginal = weekCost([...cur, r.id], recipes, p).total - curCost;
          const synergy = Object.keys(r.ing).filter(id => open.includes(id)).length;
          const s = prefScore(r, p) + synergy * 1.5 - marginal * costW - uses * 10 - (plan.some(o => o.date === slot.date && o.rid === r.id) ? 50 : 0)
            + (slot.meal === 'lunch' && r.leftovers ? 1 : 0) + rand() * 2;
          if (s > pickScore) { pickScore = s; pick = r; }
        }
        slot.rid = pick.id;
      }
      const rids = plan.map(s => s.rid).filter(Boolean);
      const cost = weekCost(rids, recipes, p).total;
      const pref = rids.reduce((s, id) => s + prefScore(recipes.find(r => r.id === id), p), 0)
        - (rids.length - new Set(rids).size) * 3;
      const fits = cost <= p.budget;
      const better = !best || (fits && !best.fits) || (fits === best.fits && (fits ? pref > best.pref || (pref === best.pref && cost < best.cost) : cost < best.cost));
      if (better) best = { plan, cost, pref, fits };
    }
    return best.plan.map(({ locked, ...s }) => s);
  }

  // Auto-Rebalancing: getauschtes/freies Slot fixieren, Rest neu optimieren.
  function rebalance(plan, keepIdx, p, recipes) {
    const locked = plan.map((s, i) => ({ ...s, locked: i === keepIdx || !s.rid }));
    return generate(p, recipes, null, locked);
  }

  const API = { setPrices, realStore, packOf, servings, store, eligible, weekCost, shareCost, generate, rebalance, prefScore, flagsOf };
  if (typeof module !== 'undefined') module.exports = API; else root.PIATTO = API;
})(this);
