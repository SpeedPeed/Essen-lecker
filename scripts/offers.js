// Flugblatt-Aktionen von marktguru.at (SPAR/EUROSPAR/INTERSPAR, HOFER, LIDL, BILLA, PENNY, ADEG) → unsere Zutaten.
const D = require('../data.js');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ADV = { SPAR: 'spar', EUROSPAR: 'spar', INTERSPAR: 'spar', 'SPAR-Gourmet': 'spar', HOFER: 'hofer', Lidl: 'lidl',
  BILLA: 'billa', 'BILLA PLUS': 'billa', PENNY: 'penny', 'ADEG Nahversorger': 'adeg', 'ADEG Aktiv': 'adeg' };

// Die Schlüssel stehen öffentlich in der marktguru-Website; bei jedem Lauf frisch auslesen, falls sie rotieren.
async function fetchAll() {
  const html = await (await fetch('https://www.marktguru.at/', { headers: { 'user-agent': UA } })).text();
  const key = n => (html.match(new RegExp(`"${n}":"([^"]+)"`)) || [])[1];
  const headers = { 'user-agent': UA, 'x-apikey': key('apiKey'), 'x-clientkey': key('clientKey') };
  if (!headers['x-apikey']) throw new Error('marktguru: API-Schlüssel nicht gefunden');
  let all = [], total = 1;
  for (let off = 0; off < total; off += 500) {
    const r = await fetch(`https://api.marktguru.at/api/v1/offers?as=web&limit=500&offset=${off}&zipCode=1010`, { headers });
    if (!r.ok) throw new Error('marktguru: HTTP ' + r.status);
    const j = await r.json();
    total = j.totalResults; all = all.concat(j.results || []);
  }
  return all;
}

// Packungsmenge in g/ml/Stk aus Preis ÷ Grundpreis (kg, l oder Stk).
function packOfOffer(o) {
  const u = o.unit && o.unit.shortName, ref = o.referencePrice;
  if (!ref || !o.price) return null;
  if (u === 'kg') return { unit: 'g', q: Math.round(o.price / ref * 1000) };
  if (u === 'l') return { unit: 'ml', q: Math.round(o.price / ref * 1000) };
  if (u === 'Stk') return { unit: 'stk', q: Math.round(o.price / ref) || 1 };
  return null;
}

// Beste gültige Aktion je Markt und Zutat. regular(store, id) = Normalpreis pro Einheit zum Vergleich.
function matchOffers(all, RULES, X, regular, today) {
  const end = new Date(Date.parse(today) + 6 * 864e5).toISOString().slice(0, 10), res = {};
  for (const o of all) {
    const store = (o.advertisers || []).map(a => ADV[a.name]).find(Boolean), v = (o.validityDates || [])[0];
    if (!store || !v || v.to.slice(0, 10) < today || v.from.slice(0, 10) > end || !o.product) continue;
    const brand = o.brand && o.brand.name !== 'thisisnobrand123' ? o.brand.name + ' ' : '', name = brand + o.product.name;
    const pk = packOfOffer(o);
    if (!pk) continue;
    for (const [id, [re, ex, min, max]] of Object.entries(RULES)) {
      const ing = D.INGREDIENTS[id], want = ing.unit === 'g' || ing.unit === 'ml' ? ing.unit : 'stk';
      if (pk.unit !== want || pk.q < min / 2 || pk.q > max * 2) continue;
      if (!new RegExp(re, 'i').test(name) || new RegExp([ex, X].filter(Boolean).join('|'), 'i').test(name)) continue;
      const unitPrice = o.price / pk.q, reg = regular(store, id);
      const was = o.oldPrice || (reg ? +(reg * pk.q).toFixed(2) : null);
      if (!was || o.price > was * 0.97 || (reg && unitPrice >= reg)) continue; // keine echte Ersparnis ggü. günstigstem Regalprodukt
      const cur = res[store] && res[store][id];
      if (cur && cur.price / cur.qty <= unitPrice) continue;
      (res[store] ||= {})[id] = { name: name.trim(), price: o.price, qty: pk.q, was,
        offer: { adv: o.advertisers[0].name, from: v.from.slice(0, 10), to: v.to.slice(0, 10), loyalty: !!o.requiresLoyalityMembership, note: o.description || '' } };
    }
  }
  return res;
}
module.exports = { fetchAll, matchOffers, packOfOffer };
