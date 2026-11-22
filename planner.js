// Piatto – Planungs-Engine (rein, ohne DOM). Läuft im Browser und in Node (test.js).
(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.PIATTO_DATA;
  const KID_FACTOR = { '1-3': 0.3, '4-10': 0.5, '11-17': 0.8 };

  const servings = p => p.adults + (p.kids.on ? p.kids.count * KID_FACTOR[p.kids.age] : 0);
  const store = p => D.STORES.find(s => s.id === p.store) || D.STORES[1];
  // Lokales Datum als JJJJ-MM-TT (toISOString wäre UTC → kurz nach Mitternacht „gestern“).
  const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ZEHEN_PRO_KNOLLE = 10;
  const WIN = 60, BASICS = new Set(['zwiebel', 'knoblauch', 'karotten', 'zitrone', 'petersilie', 'schnittlauch']);
  const flagsOf = r => new Set(Object.keys(r.ing).flatMap(id => (D.INGREDIENTS[id] || { flags: [] }).flags));

  function dietOk(flags, diet) {
    if (diet === 'vegan') return !['meat', 'fish', 'seafood', 'dairy', 'egg', 'honey'].some(f => flags.has(f));
    if (diet === 'vegetarisch') return !['meat', 'fish', 'seafood'].some(f => flags.has(f));
    if (diet === 'pescetarisch') return !flags.has('meat');
    return true;
  }

  // Harte Filter: Ernährung, Abneigungen, strenge Allergien, fehlende Geräte.
  function eligible(r, p) {
    if ((p.blocked || []).includes(r.id)) return false; // „Nicht mehr vorschlagen“
    const f = flagsOf(r);
    if (!dietOk(f, p.diet)) return false;
    if (p.dislikes.some(d => f.has(d))) return false;
    if (p.allergyMode === 'strict' && p.allergies.some(a => f.has(a))) return false;
    return r.needs.every(n => p.equipment.includes(n));
  }

  function prefScore(r, p) {
    const f = flagsOf(r);
    let s = r.tags.filter(t => p.styles.includes(t)).length * 2 + ((p.favs || []).includes(r.id) ? 2 : 0); // Favoriten öfter
    if (p.allergyMode !== 'strict') s -= p.allergies.filter(a => f.has(a)).length * 4; // Soft-Filter
    s += Math.min(3, offerSaving(r, p) * 1.5); // Aktionen nach gesparten Euro bevorzugen, nicht nach Anzahl
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
    // Bei Kopf/Bund usw. gilt 1 echtes Stück = 1 unserer Packungen; Knoblauch wird in Knollen verkauft, aber in Zehen gekocht.
    const zehe = ing.unit === 'Zehe';
    const packQty = metric || ing.unit === 'Stk' ? real.qty : zehe ? real.qty * ZEHEN_PRO_KNOLLE : ing.packQty;
    return { packQty, price: real.price, pack: metric ? (real.qty >= 1000 ? (real.qty / 1000).toLocaleString('de-AT') + (ing.unit === 'g' ? ' kg' : ' l') : real.qty + ' ' + ing.unit) : (ing.unit === 'Stk' ? real.qty + ' Stk' : zehe ? real.qty + (real.qty > 1 ? ' Knollen' : ' Knolle') : ing.pack), product: real.name, was: real.was || null, offer: real.offer || null };
  }

  // Zutaten eines Rezepts, die im gewählten Markt gerade in Aktion sind.
  const offersIn = (r, p) => Object.keys(r.ing).filter(id => !D.INGREDIENTS[id].flags.includes('pantry') && packOf(id, p).was);
  // Anteilige Ersparnis eines Gerichts durch Aktionen (wie shareCost: nach Menge, nicht nach Packung).
  const offerSaving = (r, p) => offersIn(r, p).reduce((s, id) => { const pk = packOf(id, p); return s + r.ing[id] * servings(p) / pk.packQty * (pk.was - pk.price); }, 0);
  // „Aktion“-Badge nur, wenn es sich fürs Gericht lohnt – sonst trägt jedes Gericht mit Aktions-Karotten eins.
  const hasDeal = (r, p) => { const s = offerSaving(r, p); return s >= 0.5 || (s >= 0.2 && s >= 0.15 * shareCost(r, p)); };
  const offers = p => Object.entries((realStore(p) || { items: {} }).items).filter(([, x]) => x.was).map(([id, x]) => ({ id, ...x, ing: D.INGREDIENTS[id] }));

  // Whole-Pack Costing: Wochenmenge je Zutat → ganze Packungen. Basisvorrat wird nicht gerechnet.
  function weekCost(rids, recipes, p) {
    const sv = servings(p), need = {}, n = {};
    for (const rid of rids) if (rid) n[rid] = (n[rid] || 0) + 1;
    for (const r of recipes) { // ein Durchlauf statt find() je Slot – wird im Tausch-Sheet hunderte Male aufgerufen
      if (!n[r.id]) continue;
      for (const [id, amt] of Object.entries(r.ing)) need[id] = (need[id] || 0) + amt * sv * n[r.id];
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
      const iso = isoDay(date);
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
    const pantry = id => D.INGREDIENTS[id].flags.includes('pantry'), fridge = p.fridge !== false;
    const score = new Map(pool.map(r => [r.id, prefScore(r, p)]));
    // Einmal vorberechnen: Packung + Wochenmenge je bezahlter Zutat (die innere Schleife läuft Zehntausende Male).
    const ings = new Map(recipes.map(r => [r.id, Object.entries(r.ing).filter(([id]) => D.INGREDIENTS[id] && !pantry(id)).map(([id, a]) => [id, a * sv, pack(id)])]));
    // Jedes Rezept max. 1× pro Woche – mehr nur, wenn die Filter zu wenige Rezepte übrig lassen.
    const maxUses = Math.ceil(base.length / pool.length);
    // Reste: Mittag = Abendessen vom Vortag (doppelt gekocht), wenn das Profil es will und das Rezept sich eignet.
    const lo = !!(p.leftoverLunch && p.meals.lunch && p.meals.dinner);
    const dayBefore = iso => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() - 1); return isoDay(d); };
    const nextLunchFree = (plan, slot) => { const d = new Date(slot.date + 'T12:00'); d.setDate(d.getDate() + 1); const n = plan.find(o => o.meal === 'lunch' && o.date === isoDay(d)); return !!n && !n.locked; };
    let best = null;
    const tried = [];
    // Passt nach 60 Läufen nichts ins Budget, folgen bis zu 60 sparsamere Läufe (hohes Kostengewicht).
    for (let iter = 0; iter < 60 || (iter < 120 && !best.fits); iter++) {
      const costW = iter < 60 ? 0.5 + (iter / 60) * 4 : 6 + (iter - 60) / 6;
      const plan = base.map(s => ({ ...s, rid: s.locked ? s.rid : null, leftover: s.locked ? s.leftover : undefined }));
      const need = {}, uses = {}, cats = {};
      let sweets = 0;
      const add = r => {
        for (const [id, q] of ings.get(r.id)) need[id] = (need[id] || 0) + q;
        uses[r.id] = (uses[r.id] || 0) + 1; cats[r.cat] = (cats[r.cat] || 0) + 1; if (r.sweet) sweets++;
      };
      plan.forEach(s => s.rid && byId.has(s.rid) && add(byId.get(s.rid)));
      // Großer Pool: je Slot nur ein Fenster von WIN Kandidaten aus einer pro Durchlauf neu gemischten Reihenfolge.
      const order = pool.slice();
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let off = 0;
      for (const slot of plan) {
        if (slot.locked) continue;
        if (lo && slot.meal === 'lunch') {
          const pd = plan.find(o => o.meal === 'dinner' && o.date === dayBefore(slot.date) && o.rid), r = pd && byId.get(pd.rid);
          if (r && r.leftovers) { slot.rid = r.id; slot.leftover = true; for (const [id, q] of ings.get(r.id)) need[id] = (need[id] || 0) + q; continue; }
        }
        // Abendessen, das morgen Mittag als Reste dient: doppelte Menge, dafür entfällt ein eigenes Mittagsgericht – bevorzugen.
        const twice = lo && slot.meal === 'dinner' && nextLunchFree(plan, slot);
        let pick = null, pickScore = -Infinity;
        const cands = order.length <= WIN || iter >= 60 ? order : order.slice(off, off + WIN).concat(order.slice(0, Math.max(0, off + WIN - order.length)));
        off = (off + WIN) % order.length;
        // Abwechslung am selben Tag: keine zwei Gerichte mit derselben Hauptzutat (z. B. 2× Knödelbrot)
        const today = new Set(plan.filter(o => o.date === slot.date && o.rid && o !== slot && ings.has(o.rid)).flatMap(o => ings.get(o.rid).map(x => x[0])).filter(id => !BASICS.has(id)));
        for (const r of cands) {
          const u = uses[r.id] || 0;
          if (u >= maxUses) continue;
          // Grenzkosten über ganze Packungen + Synergie mit bereits geöffneten Packungen
          let marginal = 0, synergy = 0;
          let sameDay = 0;
          const f = twice && r.leftovers ? 2 : 1;
          for (const [id, q, k] of ings.get(r.id)) {
            if (today.has(id)) sameDay++;
            const have = need[id] || 0, open = Math.ceil(have / k.packQty - 1e-9);
            marginal += (Math.ceil((have + q) / k.packQty - 1e-9) - open) * k.price;
            if (fridge && have > 0 && open * k.packQty - have > 1e-9) synergy++;
          }
          const sc = score.get(r.id) + synergy * 1.5 - marginal * costW - u * 10 - sameDay * 6
            - (plan.some(o => o.date === slot.date && o.rid === r.id) ? 50 : 0)
            - (r.sweet && sweets >= 1 ? 30 : 0) - (cats[r.cat] || 0) * 1.5 // Abwechslung: max. 1 Süßspeise, Kategorien mischen
            + (slot.meal === 'lunch' && r.leftovers ? 1 : 0) + (f === 2 ? 6 : 0) + rand() * 2;
          if (sc > pickScore) { pickScore = sc; pick = r; }
        }
        if (!pick) pick = pool[Math.floor(rand() * pool.length)];
        slot.rid = pick.id; add(pick);
      }
      const rids = plan.filter(s => s.rid && !s.leftover).map(s => s.rid); // Reste-Mittage zählen nicht als Wiederholung
      const cost = weekCost(plan.map(s => s.rid).filter(Boolean), recipes, p).total;
      const pref = rids.reduce((s, id) => s + (score.get(id) ?? prefScore(byId.get(id), p)), 0)
        - (rids.length - new Set(rids).size) * 3 - Math.max(0, sweets - 1) * 10;
      const fits = cost <= p.budget;
      const better = !best || (fits && !best.fits) || (fits === best.fits && (fits ? pref > best.pref || (pref === best.pref && cost < best.cost) : cost < best.cost));
      if (better) best = { plan, cost, pref, fits };
      if (!fits) tried.push({ plan, cost });
    }
    if (!best.fits) {
      // Nachbessern ab den 6 günstigsten Entwürfen (Einzeltausch bleibt sonst oft in einem lokalen Minimum hängen).
      const outs = tried.sort((a, b) => a.cost - b.cost).slice(0, 6).map(t => ({ plan: t.plan, cost: fitBudget(t.plan, t.cost) }));
      const ok = outs.filter(o => o.cost <= p.budget + 1e-9);
      best = { plan: (ok.length ? ok.sort((a, b) => planPref(b.plan) - planPref(a.plan))[0] : outs.sort((a, b) => a.cost - b.cost)[0]).plan };
    }
    return best.plan.map(({ locked, ...s }) => s);

    function planPref(plan) { return plan.reduce((s, x) => s + (x.rid ? score.get(x.rid) ?? 0 : 0), 0); }

    // Knapp über Budget: einzelne Gerichte gegen günstigere tauschen. Bevorzugt den Tausch, der ins Budget führt und
    // am besten zum Profil passt; sonst den, der am meisten spart. Kosten inkrementell über ganze Packungen.
    function fitBudget(plan, total) {
      const need = {}, put = (rid, f) => { for (const [id, q] of ings.get(rid)) need[id] = (need[id] || 0) + f * q; };
      const packs = id => { const q = need[id] || 0, k = pack(id); return q > 1e-9 ? Math.ceil(q / k.packQty - 1e-9) * k.price : 0; };
      plan.forEach(s => s.rid && ings.has(s.rid) && put(s.rid, 1));
      for (let round = 0; round < plan.length && total > p.budget + 1e-9; round++) {
        const used = new Set(plan.map(s => s.rid));
        let fit = null, cut = null;
        plan.forEach((s, i) => {
          if (s.locked || !s.rid || !ings.has(s.rid) || s.leftover || plan.some(o => o.leftover && o.rid === s.rid)) return;
          for (const r of pool) {
            if (used.has(r.id)) continue;
            const ids = new Set([...ings.get(s.rid), ...ings.get(r.id)].map(x => x[0]));
            let d = 0;
            for (const id of ids) d -= packs(id);
            put(s.rid, -1); put(r.id, 1);
            for (const id of ids) d += packs(id);
            put(r.id, -1); put(s.rid, 1);
            if (d > -0.005) continue;
            const sc = score.get(r.id) - (score.get(s.rid) ?? 0);
            if (total + d <= p.budget) { if (!fit || sc > fit.sc || (sc === fit.sc && d < fit.d)) fit = { i, rid: r.id, d, sc }; }
            else if (!cut || d < cut.d) cut = { i, rid: r.id, d, sc };
          }
        });
        const mv = fit || cut;
        if (!mv) break;
        put(plan[mv.i].rid, -1); put(mv.rid, 1); plan[mv.i].rid = mv.rid; total += mv.d;
      }
      return total;
    }
  }


  // Neue Woche: ausgesetzte Slots (skip: 'self' = selbst kochen, 'free' = frei/Reste) und fixierte Gerichte (pinned) bleiben,
  // feste Kochpause-Wochentage aus dem Profil (p.skipDays, 0 = Sonntag) werden automatisch ausgesetzt.
  function planWeek(p, recipes, old = [], start = new Date()) {
    const base = slotsFor(p, start).map(s => {
      const o = old.find(x => x.date === s.date && x.meal === s.meal && x.skip);
      if (o) return { ...s, skip: o.skip, note: o.note, locked: true };
      const pin = old.find(x => x.date === s.date && x.meal === s.meal && x.pinned && x.rid);
      const r = pin && recipes.find(x => x.id === pin.rid);
      if (r && eligible(r, p)) return { ...s, rid: r.id, pinned: true, ...(pin.leftover ? { leftover: true } : {}), locked: true };
      if ((p.skipDays || []).includes(new Date(s.date + 'T12:00').getDay())) return { ...s, skip: 'self', note: '', locked: true };
      return s;
    });
    return generate(p, recipes, null, base);
  }

  // Auto-Rebalancing: getauschtes/freies Slot fixieren, Rest neu optimieren. Fixierte Gerichte, Reste-Slots und das
  // Gericht, von dem sie stammen, bleiben ebenfalls stehen.
  function rebalance(plan, keepIdx, p, recipes) {
    const locked = plan.map((s, i) => ({ ...s, locked: i === keepIdx || !s.rid || s.pinned || plan.some(o => o.leftover && o.rid === s.rid) }));
    return generate(p, recipes, null, locked);
  }

  // Suche: Umlaute egal (knoedel = Knödel), bundesdeutsche Begriffe finden die österreichischen Namen der Rezepte.
  const fold = x => x.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const SYN = [['kartoffeln', 'erdaepfel'], ['kartoffel', 'erdaepfel'], ['tomaten', 'paradeis'], ['tomate', 'paradeis'], ['hackfleisch', 'faschiert'], ['hack', 'faschiert'], ['sahne', 'obers'],
    ['quark', 'topfen'], ['blumenkohl', 'karfiol'], ['aubergine', 'melanzani'], ['pilz', 'schwammerl'], ['champignon', 'schwammerl'],
    ['haehnchen', 'hendl'], ['huehnchen', 'hendl'], ['frikadelle', 'laibchen'], ['bulette', 'laibchen'], ['pfannkuchen', 'palatschinken'],
    ['eierkuchen', 'palatschinken'], ['broetchen', 'semmel'], ['rote bete', 'rote rueben'], ['moehre', 'karotte'], ['paniermehl', 'broesel'],
    ['meerrettich', 'kren'], ['kloesse', 'knoedel'], ['kloss', 'knoedel'], ['aprikose', 'marille'], ['pflaume', 'zwetschk'],
    ['feldsalat', 'vogerlsalat'], ['kopfsalat', 'haeuptelsalat'], ['weisskohl', 'kraut'], ['rotkohl', 'rotkraut'], ['porree', 'lauch'],
    ['gruene bohnen', 'fisolen'], ['puderzucker', 'staubzucker'], ['huhn', 'hendl'], ['hendl', 'huhn']];
  const hay = new WeakMap();
  function matches(r, q) {
    q = fold(q || '').trim();
    if (!q) return true;
    let h = hay.get(r);
    if (!h) hay.set(r, h = fold(r.title + ' ' + r.cat + ' ' + Object.keys(r.ing).map(i => (D.INGREDIENTS[i] || { name: i }).name).join(' ')));
    const words = SYN.reduce((t, [a, b]) => t.includes(a) && a.includes(' ') ? t.replace(a, b.replace(' ', '_')) : t, q).split(/\s+/).map(w => w.replace('_', ' '));
    return words.every(w => {
      const alts = [w, ...SYN.filter(([a]) => w.includes(a)).map(([a, b]) => w.replace(a, b))];
      return alts.some(x => h.includes(x) || (x.length > 4 && h.includes(x.replace(/(en|n|e|s)$/, ''))));
    });
  }

  const API = { isoDay, matches, planWeek, offers, offersIn, offerSaving, hasDeal, setPrices, realStore, packOf, servings, store, eligible, weekCost, shareCost, generate, rebalance, prefScore, flagsOf };
  if (typeof module !== 'undefined') module.exports = API; else root.PIATTO = API;
})(this);
