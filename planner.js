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
    s += offersIn(r, p).length * 1.5; // Supermarkt-Aktionen bevorzugen
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
    return { packQty, price: real.price, pack: metric ? (real.qty >= 1000 ? (real.qty / 1000).toLocaleString('de-AT') + (ing.unit === 'g' ? ' kg' : ' l') : real.qty + ' ' + ing.unit) : (ing.unit === 'Stk' ? real.qty + ' Stk' : ing.pack), product: real.name, was: real.was || null, offer: real.offer || null };
  }

  // Zutaten eines Rezepts, die im gewählten Markt gerade in Aktion sind.
  const offersIn = (r, p) => Object.keys(r.ing).filter(id => !D.INGREDIENTS[id].flags.includes('pantry') && packOf(id, p).was);
  const offers = p => Object.entries((realStore(p) || { items: {} }).items).filter(([, x]) => x.was).map(([id, x]) => ({ id, ...x, ing: D.INGREDIENTS[id] }));

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
      return { id, ing, qty, packs, cost, pantry, leftover: packs * pk.packQty - qty, pack: pk.pack, product: pk.product, saved: pk.was && !pantry ? packs * (pk.was - pk.price) : 0, offer: pk.offer };
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
    const byId = new Map(recipes.map(r => [r.id, r])), sv = servings(p), pk = {};
    const pack = id => pk[id] || (pk[id] = packOf(id, p));
    const pantry = id => D.INGREDIENTS[id].flags.includes('pantry');
    const score = new Map(pool.map(r => [r.id, prefScore(r, p)]));
    // Jedes Rezept max. 1× pro Woche – mehr nur, wenn die Filter zu wenige Rezepte übrig lassen.
    const maxUses = Math.ceil(base.length / pool.length);
    let best = null;
    for (let iter = 0; iter < 60; iter++) {
      const costW = 0.5 + (iter / 60) * 4;
      const plan = base.map(s => ({ ...s, rid: s.locked ? s.rid : null }));
      const need = {}, uses = {}, cats = {};
      let sweets = 0;
      const add = r => {
        for (const [id, a] of Object.entries(r.ing)) need[id] = (need[id] || 0) + a * sv;
        uses[r.id] = (uses[r.id] || 0) + 1; cats[r.cat] = (cats[r.cat] || 0) + 1; if (r.sweet) sweets++;
      };
      plan.forEach(s => s.rid && byId.has(s.rid) && add(byId.get(s.rid)));
      for (const slot of plan) {
        if (slot.locked) continue;
        let pick = null, pickScore = -Infinity;
        for (const r of pool) {
          const u = uses[r.id] || 0;
          if (u >= maxUses) continue;
          // Grenzkosten über ganze Packungen + Synergie mit bereits geöffneten Packungen
          let marginal = 0, synergy = 0;
          for (const [id, a] of Object.entries(r.ing)) {
            if (pantry(id)) continue;
            const k = pack(id), have = need[id] || 0;
            marginal += (Math.ceil((have + a * sv) / k.packQty - 1e-9) - Math.ceil(have / k.packQty - 1e-9)) * k.price;
            if (p.fridge !== false && have > 0 && Math.ceil(have / k.packQty - 1e-9) * k.packQty - have > 1e-9) synergy++;
          }
          const sc = score.get(r.id) + synergy * 1.5 - marginal * costW - u * 10
            - (plan.some(o => o.date === slot.date && o.rid === r.id) ? 50 : 0)
            - (r.sweet && sweets >= 1 ? 30 : 0) - (cats[r.cat] || 0) * 1.5 // Abwechslung: max. 1 Süßspeise, Kategorien mischen
            + (slot.meal === 'lunch' && r.leftovers ? 1 : 0) + rand() * 2;
          if (sc > pickScore) { pickScore = sc; pick = r; }
        }
        if (!pick) pick = pool[Math.floor(rand() * pool.length)];
        slot.rid = pick.id; add(pick);
      }
      const rids = plan.map(s => s.rid).filter(Boolean);
      const cost = weekCost(rids, recipes, p).total;
      const pref = rids.reduce((s, id) => s + (score.get(id) ?? prefScore(byId.get(id), p)), 0)
        - (rids.length - new Set(rids).size) * 3 - Math.max(0, sweets - 1) * 10;
      const fits = cost <= p.budget;
      const better = !best || (fits && !best.fits) || (fits === best.fits && (fits ? pref > best.pref || (pref === best.pref && cost < best.cost) : cost < best.cost));
      if (better) best = { plan, cost, pref, fits };
    }
    return best.plan.map(({ locked, ...s }) => s);
  }


  // Neue Woche: ausgesetzte Slots (skip: 'self' = selbst kochen, 'free' = frei/Reste) bleiben,
  // feste Kochpause-Wochentage aus dem Profil (p.skipDays, 0 = Sonntag) werden automatisch ausgesetzt.
  function planWeek(p, recipes, old = [], start = new Date()) {
    const base = slotsFor(p, start).map(s => {
      const o = old.find(x => x.date === s.date && x.meal === s.meal && x.skip);
      if (o) return { ...s, skip: o.skip, note: o.note, locked: true };
      if ((p.skipDays || []).includes(new Date(s.date + 'T12:00').getDay())) return { ...s, skip: 'self', note: '', locked: true };
      return s;
    });
    return generate(p, recipes, null, base);
  }

  // Auto-Rebalancing: getauschtes/freies Slot fixieren, Rest neu optimieren.
  function rebalance(plan, keepIdx, p, recipes) {
    const locked = plan.map((s, i) => ({ ...s, locked: i === keepIdx || !s.rid }));
    return generate(p, recipes, null, locked);
  }

  const API = { planWeek, offers, offersIn, setPrices, realStore, packOf, servings, store, eligible, weekCost, shareCost, generate, rebalance, prefScore, flagsOf };
  if (typeof module !== 'undefined') module.exports = API; else root.PIATTO = API;
})(this);
