// Piatto – UI. Local-First: alles liegt in localStorage.
const D = window.PIATTO_DATA, P = window.PIATTO;
const KEY = 'piatto.v1';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n, d = 2) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });

const DEFAULT_PROFILE = {
  store: null, adults: 2, kids: { on: false, count: 1, age: '4-10' }, meals: { lunch: false, dinner: true },
  budget: 50, styles: [], diet: 'none', dislikes: [], allergies: [], allergyMode: 'soft',
  equipment: ['kochfeld', 'ofen'], fridge: true, freezer: true,
};
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
S = Object.assign({ profile: structuredClone(DEFAULT_PROFILE), onboarded: false, plan: [], checked: {}, extras: [], favs: [], custom: [] }, S || {});
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Speichern nicht möglich (Speicher voll oder blockiert).'); } };

const ui = { view: S.onboarded ? 'plan' : 'onboarding', step: 0, editing: false, draft: null, recipe: null, back: 'plan',
  cookStep: 0, timers: {}, sheet: null, q: '', filter: 'alle', form: null };

const recipes = () => D.RECIPES.concat(S.custom);
const R = id => recipes().find(r => r.id === id);
const prof = () => ui.view === 'onboarding' ? ui.draft : S.profile;

// ---------- Onboarding ----------
const sel = (on) => `aria-pressed="${!!on}"`;
const sw = (a, on, extra = '') => `<button class="switch" role="switch" aria-checked="${!!on}" data-a="${a}" ${extra}></button>`;
const budgetMax = p => Math.max(160, Math.ceil(P.servings(p) * 45 / 10) * 10);

function tableSVG(p) {
  const plates = [...Array(p.adults).fill('a'), ...(p.kids.on ? Array(p.kids.count).fill('k') : [])];
  const n = plates.length;
  return `<svg viewBox="0 0 300 220" role="img" aria-label="Esstisch mit ${n} Gedecken" style="width:100%;max-height:240px">
    <ellipse cx="150" cy="114" rx="120" ry="76" fill="#d8c3a5"/><ellipse cx="150" cy="110" rx="120" ry="76" fill="#e9d8bf"/>
    ${plates.map((t, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x = 150 + Math.cos(a) * 88, y = 110 + Math.sin(a) * 52, r = t === 'a' ? 19 : 13;
      return `<g style="transition:all .3s"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#3D2C24" stroke-opacity=".15"/>
        <circle cx="${x}" cy="${y}" r="${r * .62}" fill="${t === 'a' ? '#F3EFEA' : '#E8C568'}"/></g>`;
    }).join('')}
    <text x="150" y="116" text-anchor="middle" font-family="Fraunces" font-size="15" fill="#3D2C24">${n} am Tisch</text></svg>`;
}

const APPL = {
  mikrowelle: [20, 18, 92, 54, '#cfd6d4', '📻'], mixer: [126, 26, 40, 46, '#e8c568', '🫙'], airfryer: [180, 22, 54, 50, '#3D2C24', '🍟'],
  slowcooker: [246, 28, 58, 44, '#a8553a', '🍲'], kochfeld: [40, 104, 110, 22, '#2a1f1a', '🔥'], ofen: [40, 134, 110, 72, '#6d5a4f', '♨️'],
};
function kitchenSVG(p) {
  return `<svg viewBox="0 0 320 220" style="width:100%;max-height:260px" aria-label="Küche – Geräte antippen">
    <rect x="0" y="0" width="320" height="220" rx="16" fill="#F3EFEA"/><rect x="10" y="80" width="300" height="20" rx="4" fill="#d8c3a5"/>
    <rect x="10" y="100" width="300" height="112" rx="4" fill="#e9d8bf"/>
    ${D.EQUIPMENT.map(([id, label]) => {
      const [x, y, w, h, c, ic] = APPL[id], on = p.equipment.includes(id);
      return `<g class="appl" role="button" tabindex="0" aria-pressed="${on}" aria-label="${label}" data-a="equip" data-id="${id}" opacity="${on ? 1 : .35}">
        <rect class="body" x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${c}"/>
        <text x="${x + w / 2}" y="${y + h / 2 + 6}" text-anchor="middle" font-size="18">${ic}</text>
        ${on ? `<circle cx="${x + w - 4}" cy="${y + 4}" r="8" fill="#4A7C59"/><text x="${x + w - 4}" y="${y + 8}" text-anchor="middle" font-size="11" fill="#fff">✓</text>` : ''}</g>`;
    }).join('')}</svg>`;
}

const STEPS = [
  { t: 'Wo kaufst du ein?', s: 'Preise und Gang-Reihenfolge passen sich deinem Markt an.', ok: p => p.store,
    b: p => `<div class="grid">${D.STORES.map(s => `<button class="opt" ${sel(p.store === s.id)} data-a="store" data-id="${s.id}">
      <span class="logo" style="color:${p.store === s.id ? 'inherit' : s.color}">${s.name}</span>${s.sub ? `<small>${s.sub}</small>` : ''}<small>${s.profile}</small>${P.realStore({ store: s.id }) ? `<small>✓ ${P.realStore({ store: s.id }).offersOnly ? 'echte Aktionen' : 'echte Preise & Aktionen'}</small>` : ''}</button>`).join('')}</div>` },
  { t: 'Für wen kochst du?', s: 'Portionen werden automatisch skaliert.', ok: () => true,
    b: p => `${tableSVG(p)}<div class="card"><div class="row between"><b>Erwachsene</b><div class="stepper">
      <button data-a="adults" data-d="-1" aria-label="weniger">−</button><b>${p.adults}</b><button data-a="adults" data-d="1" aria-label="mehr">+</button></div></div>
      <div class="toggle"><b>Kinder</b>${sw('kids', p.kids.on, 'aria-label="Kinder"')}</div>
      ${p.kids.on ? `<div class="row between" style="margin-bottom:12px"><span>Anzahl</span><div class="stepper">
        <button data-a="kidcount" data-d="-1" aria-label="weniger">−</button><b>${p.kids.count}</b><button data-a="kidcount" data-d="1" aria-label="mehr">+</button></div></div>
        <div class="seg">${['1-3', '4-10', '11-17'].map(a => `<button ${sel(p.kids.age === a)} data-a="kidage" data-id="${a}">${a} J.</button>`).join('')}</div>` : ''}</div>` },
  { t: 'Welche Mahlzeiten?', s: 'Wir planen 7 Tage.', ok: p => p.meals.lunch || p.meals.dinner,
    b: p => `<div class="card"><div class="toggle"><div><b>Mittagessen</b><div class="muted">Gut mit Resten</div></div>${sw('meal', p.meals.lunch, 'data-id="lunch" aria-label="Mittagessen"')}</div>
      <div class="toggle"><div><b>Abendessen</b><div class="muted">Die Hauptmahlzeit</div></div>${sw('meal', p.meals.dinner, 'data-id="dinner" aria-label="Abendessen"')}</div></div>` },
  { t: 'Wie hoch ist dein Wochenbudget?', s: 'Wir rechnen mit ganzen Supermarkt-Packungen.', ok: () => true,
    b: p => `<div class="card"><div class="big-amount" id="budgetval">${eur(p.budget, 0)}</div><div class="muted" style="text-align:center;margin-bottom:16px">pro Woche · ca. <span id="perserv">${eur(p.budget / (7 * ((+p.meals.lunch) + (+p.meals.dinner)) * P.servings(p)))}</span> pro Portion</div>
      <input type="range" min="20" max="${budgetMax(p)}" step="1" value="${p.budget}" data-i="budget" aria-label="Wochenbudget">
      <div class="row between muted"><span>20 €</span><span>${budgetMax(p)} €</span></div></div>` },
  { t: 'Worauf hast du Appetit?', s: 'Wähle bis zu 3.', ok: () => true,
    b: p => `<div class="chips">${D.STYLES.map(([id, l]) => `<button class="chip" ${sel(p.styles.includes(id))} data-a="style" data-id="${id}">${l}</button>`).join('')}</div>` },
  { t: 'Besondere Ernährungsweise?', s: '', ok: () => true,
    b: p => `<div class="grid">${D.DIETS.map(([id, l]) => `<button class="opt" ${sel(p.diet === id)} data-a="diet" data-id="${id}"><b>${l}</b></button>`).join('')}</div>` },
  { t: 'Gibt es etwas, das du nicht isst?', s: 'Diese Zutaten kommen nicht in deinen Plan.', ok: () => true,
    b: p => `<div class="chips">${D.DISLIKES.map(([id, l]) => `<button class="chip" ${sel(p.dislikes.includes(id))} data-a="dislike" data-id="${id}">${l}</button>`).join('')}</div>
      <button class="btn ghost" style="margin-top:20px" data-a="eatall" ${sel(!p.dislikes.length)}>${!p.dislikes.length ? '✓ ' : ''}Ich esse alles</button>` },
  { t: 'Allergien?', s: '', ok: () => true,
    b: p => `<div class="chips">${D.ALLERGENS.map(([id, l]) => `<button class="chip" ${sel(p.allergies.includes(id))} data-a="allergy" data-id="${id}">${l}</button>`).join('')}</div>
      ${p.allergies.length ? `<div class="card sand" style="margin-top:20px"><b>Wie streng?</b><p class="muted">„Lieber vermeiden“ bevorzugt andere Gerichte, „Streng“ schließt sie komplett aus.</p>
        <div class="seg"><button ${sel(p.allergyMode === 'soft')} data-a="amode" data-id="soft">Lieber vermeiden</button><button ${sel(p.allergyMode === 'strict')} data-a="amode" data-id="strict">Streng – nie verwenden</button></div></div>` : ''}` },
  { t: 'Was hast du in deiner Küche?', s: 'Tippe die Geräte an, die du hast.', ok: () => true,
    b: p => `${kitchenSVG(p)}<div class="chips" style="margin:12px 0">${D.EQUIPMENT.map(([id, l]) => `<button class="chip" ${sel(p.equipment.includes(id))} data-a="equip" data-id="${id}">${l}</button>`).join('')}</div>
      <div class="card"><div class="toggle"><div><b>Kühlschrank</b><div class="muted">Reste & offene Packungen aufheben</div></div>${sw('store2', p.fridge, 'data-id="fridge" aria-label="Kühlschrank"')}</div>
      <div class="toggle"><div><b>Gefrierschrank</b><div class="muted">Portionen einfrieren</div></div>${sw('store2', p.freezer, 'data-id="freezer" aria-label="Gefrierschrank"')}</div></div>` },
];

function vOnboarding() {
  const st = STEPS[ui.step], p = ui.draft;
  return `<div class="ob-head row">${(ui.step > 0 || ui.editing) ? `<button class="back" data-a="obback" aria-label="Zurück">←</button>` : ''}
    ${ui.editing ? '' : `<div class="progress" aria-label="Schritt ${ui.step + 1} von ${STEPS.length}"><i style="width:${(ui.step + 1) / STEPS.length * 100}%"></i></div><span class="muted">${ui.step + 1}/${STEPS.length}</span>`}</div>
    <h1>${st.t}</h1>${st.s ? `<p class="muted">${st.s}</p>` : ''}${st.b(p)}
    <div class="footer-cta"><button class="btn" data-a="obnext" ${st.ok(p) ? '' : 'disabled'}>${ui.editing ? 'Speichern' : ui.step === STEPS.length - 1 ? 'Meinen Plan erstellen' : 'Weiter'}</button></div>`;
}

// ---------- Plan ----------
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const dayLabel = iso => { const d = new Date(iso + 'T12:00'); return `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`; };
let CREDITS = {};
const photo = (r, cls = '') => `<div class="photo ${cls}" style="background:linear-gradient(135deg,hsl(${r.hue ?? 30} 70% 88%),hsl(${r.hue ?? 30} 55% 72%))" aria-hidden="true">${CREDITS[r.id] ? `<img src="img/${r.id}.jpg" alt="" loading="lazy">` : esc(r.emoji || '🍽️')}</div>`;
const credit = id => { const c = CREDITS[id]; return c ? `<p class="muted" style="font-size:12px;margin-top:-8px">Foto: <a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a> von ${esc(c.creator || 'unbekannt')}, ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</p>` : ''; };
const cost = () => P.weekCost(S.plan.map(s => s.rid), recipes(), S.profile);
const itemCount = () => cost().items.filter(i => !i.pantry).length + S.extras.length;

function ring(spent, budget) {
  const pct = Math.min(1, spent / budget), C = 2 * Math.PI * 42, over = spent > budget;
  return `<svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="${eur(spent, 0)} von ${eur(budget, 0)}">
    <circle cx="50" cy="50" r="42" fill="none" stroke="#F3EFEA" stroke-width="10"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="${over ? '#b54a3a' : '#4A7C59'}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${C * pct} ${C}" transform="rotate(-90 50 50)" style="transition:stroke-dasharray .5s"/>
    <text x="50" y="50" text-anchor="middle" font-family="Fraunces" font-size="20" font-weight="700" fill="#3D2C24">${eur(spent, 0)}</text>
    <text x="50" y="66" text-anchor="middle" font-size="9" fill="#7a6c63">geschätzt</text></svg>`;
}

function vPlan() {
  const p = S.profile, st = P.store(p), c = cost(), meals = S.plan.filter(s => s.rid).length, left = p.budget - c.total;
  const days = [...new Set(S.plan.map(s => s.date))], saved = c.items.reduce((t, i) => t + i.saved, 0);
  return `<div class="row between"><h1>Deine Woche</h1><button class="btn small ghost" data-a="regen">↻ Neu planen</button></div>
    <div class="card banner"><span class="badge" style="background:${st.color}">${st.name}</span>
      <div class="grow"><b>${itemCount()} Artikel nach Gang</b><div class="muted">${priceNote(st)}</div></div>
      <button class="btn small" data-a="go" data-id="list">Liste öffnen</button></div>
    <div class="card row">${ring(c.total, p.budget)}<div class="grow">
      <div class="muted">${meals} Mahlzeiten · ${fmtServ(P.servings(p))} Portionen</div>
      <h2 class="${left < 0 ? 'over' : 'price'}" style="margin:4px 0">${left < 0 ? `${eur(-left, left > -1 ? 2 : 0)} über Budget` : `${eur(left, 0)} übrig`}</h2>
      <div class="muted">Budget ${eur(p.budget, 0)} / Woche</div>
      ${saved ? `<div class="offer-text">🏷 Aktionen sparen dir ${eur(saved)}</div>` : ''}
      ${left < 0 ? `<button class="btn small" style="margin-top:8px" data-a="rebalance">Automatisch ausgleichen</button>` : ''}</div></div>
    ${vOffers()}
    ${!S.plan.length ? `<div class="card"><p>Keine passenden Rezepte für deine Filter gefunden. Passe dein Profil an.</p></div>` : ''}
    ${days.map(d => `<div class="daylabel">${dayLabel(d)}</div>${S.plan.map((s, i) => s.date !== d ? '' : slotCard(s, i)).join('')}`).join('')}`;
}
const offerTag = r => P.offersIn(r, S.profile).length ? '<span class="tag offer">🏷 Aktion</span>' : '';
function vOffers() {
  const p = S.profile, st = P.store(p), list = P.offers(p), rs = recipes().filter(r => P.eligible(r, p)), planned = S.plan.map(s => s.rid);
  if (!P.realStore(p)) return '';
  if (!list.length) return `<p class="muted" style="margin:4px">Gerade keine ${st.name}-Aktionen auf Zutaten deiner Rezepte.</p>`;
  return `<div class="row between" style="margin:16px 4px 6px"><h3 style="margin:0">Angebote diese Woche</h3><span class="muted">${st.name}</span></div>
    <div class="offers">${list.sort((a, b) => b.was / b.price - a.was / a.price).map(o => {
      const uses = rs.filter(r => r.ing[o.id]), inPlan = uses.filter(r => planned.includes(r.id));
      return `<button class="card offer-card" data-a="offer" data-id="${o.id}"><span class="tag offer">−${Math.round((1 - o.price / o.was) * 100)} %</span>
        <b>${esc(o.ing.name)}</b><div class="muted">${esc(o.name)}</div>
        <div><b class="price">${eur(o.price)}</b> <s class="muted">${eur(o.was)}</s></div>
        ${o.offer ? `<div class="muted" style="font-size:12px">${offerWhen(o.offer)}</div>` : ''}
        <div class="muted" style="font-size:12px">${inPlan.length ? `✓ im Plan: ${esc(inPlan[0].title)}` : uses.length ? `${uses.length} Rezept${uses.length > 1 ? 'e' : ''} passen` : 'in keinem Rezept'}</div></button>`;
    }).join('')}</div>`;
}
const fmtServ = n => (Math.round(n * 10) / 10).toLocaleString('de-AT');
const MEAL = { lunch: 'Mittag', dinner: 'Abend' };

function slotCard(s, i) {
  const both = S.profile.meals.lunch && S.profile.meals.dinner;
  if (!s.rid) {
    const self = s.skip === 'self';
    return `<div class="card day sand"><div class="photo" style="background:var(--card)">${self ? '🧑‍🍳' : '🛋️'}</div><div class="grow">
    <span class="tag">${both ? MEAL[s.meal] + ' · ' : ''}Ausgesetzt</span><h3>${self ? (s.note ? esc(s.note) : 'Ich koche selbst') : 'Freier Abend / Reste-Tag'}</h3>
    <div class="meta">${self ? 'Dein eigenes Gericht – nicht in der Einkaufsliste' : 'Reste genießen oder auswärts essen'}</div></div>
    <button class="swap" data-a="swap" data-i="${i}" aria-label="Gericht einplanen">⇄</button></div>`;
  }
  const r = R(s.rid);
  if (!r) return '';
  return `<div class="card day"><button style="display:contents" data-a="recipe" data-id="${r.id}">${photo(r)}<div class="grow" style="text-align:left">
    <span class="tag">${both ? MEAL[s.meal] + ' · ' : ''}${esc(r.cat)}</span>${offerTag(r)}<h3>${esc(r.title)}</h3>
    <div class="meta"><span>⏱ ${fmtTime(r.time)}</span><span>👥 ${fmtServ(P.servings(S.profile))}</span><span class="price">${eur(P.shareCost(r, S.profile), 0)}</span></div></div></button>
    <button class="swap" data-a="swap" data-i="${i}" aria-label="Gericht tauschen">⇄</button></div>`;
}
const fmtTime = m => m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ' ' + m % 60 + ' Min.' : ''}` : `${m} Min.`;

function vSwapSheet() {
  const i = ui.sheet.i, slot = S.plan[i], p = S.profile, rids = S.plan.map(s => s.rid);
  const alts = recipes().filter(r => P.eligible(r, p) && r.id !== slot.rid).map(r => {
    const t = P.weekCost(rids.map((x, j) => j === i ? r.id : x), recipes(), p).total;
    return { r, t };
  }).sort((a, b) => rids.includes(a.r.id) - rids.includes(b.r.id) || a.t - b.t);
  const cur = cost().total;
  return `<div class="sheet-bg" data-a="closesheet"><div class="sheet" role="dialog" aria-label="Gericht tauschen" data-stop>
    <div class="row between"><h2>Tauschen oder aussetzen</h2><button class="back" data-a="closesheet" aria-label="Schließen">✕</button></div>
    <p class="muted">${dayLabel(slot.date)} · sortiert nach Wochenpreis. Aktuell ${eur(cur)}.</p>
    <div class="card sand" style="padding:12px"><b>Diesen ${slot.meal === 'lunch' ? 'Mittag' : 'Abend'} aussetzen</b>
      <input id="selfnote" placeholder="Was kochst du? (optional, z. B. Omas Gulasch)" maxlength="60" value="${esc(slot.skip === 'self' ? slot.note || '' : '')}" style="margin:8px 0">
      <div class="row"><button class="btn small grow" data-a="skip" data-id="self">🧑‍🍳 Ich koche selbst</button><button class="btn small ghost grow" data-a="skip" data-id="free">🛋️ Frei / Reste</button></div>
      ${slot.rid ? `<div class="muted" style="margin-top:6px;font-size:13px">Spart ${eur(cur - P.weekCost(rids.map((x, j) => j === i ? null : x), recipes(), p).total)} – Zutaten fallen aus der Einkaufsliste.</div>` : ''}</div>
    <h3 style="margin-top:16px">Anderes Gericht</h3>
    ${alts.map(({ r, t }) => { const d = t - cur, over = t > p.budget;
      return `<button class="alt" data-a="pick" data-id="${r.id}">${photo(r)}<div class="grow"><b>${esc(r.title)}</b> ${offerTag(r)}
      <div class="meta"><span>⏱ ${fmtTime(r.time)}</span><span class="${over ? 'over' : 'price'}">${d > 0.005 ? '+' : ''}${eur(d)} Woche</span>${over ? '<span class="over">über Budget</span>' : ''}${rids.includes(r.id) ? '<span>· schon in dieser Woche</span>' : ''}</div></div></button>`; }).join('')}
  </div></div>`;
}

// ---------- Rezept & Kochmodus ----------
function fmtQty(qty, unit) {
  if (!qty) return 'nach Geschmack';
  if (unit === 'g' || unit === 'ml') return qty >= 1000 ? `${(Math.round(qty / 100) / 10).toLocaleString('de-AT')} ${unit === 'g' ? 'kg' : 'l'}` : `${Math.round(qty / 5) * 5 || Math.round(qty)} ${unit}`;
  const r = Math.round(qty * 2) / 2 || 0.5;
  return `${r.toLocaleString('de-AT')} ${unit}`;
}
function donut(m) {
  const [kcal, p, c, f] = m, parts = [[p * 4, '#4A7C59', 'Eiweiß', p], [c * 4, '#E8C568', 'Kohlenhydrate', c], [f * 9, '#3D2C24', 'Fett', f]];
  const tot = parts.reduce((s, x) => s + x[0], 0) || 1, C = 2 * Math.PI * 40; let off = 0;
  return `<div class="row"><svg viewBox="0 0 100 100" width="110" height="110" role="img" aria-label="${kcal} kcal">
    ${parts.map(([v, col]) => { const l = v / tot * C, s = `<circle cx="50" cy="50" r="40" fill="none" stroke="${col}" stroke-width="12" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"/>`; off += l; return s; }).join('')}
    <text x="50" y="50" text-anchor="middle" font-family="Fraunces" font-size="20" font-weight="700" fill="#3D2C24">${kcal}</text><text x="50" y="64" text-anchor="middle" font-size="9" fill="#7a6c63">kcal</text></svg>
    <div class="grow">${parts.map(([, col, l, g]) => `<div class="row" style="margin:6px 0"><i style="width:10px;height:10px;border-radius:3px;background:${col}"></i><span class="grow">${l}</span><b>${g} g</b></div>`).join('')}</div></div>`;
}
function vRecipe() {
  const r = R(ui.recipe), p = S.profile, sv = P.servings(p);
  if (!r) { ui.view = 'plan'; return vPlan(); }
  const fav = S.favs.includes(r.id);
  return `<div class="row between" style="margin-bottom:12px"><button class="back" data-a="go" data-id="${ui.back}" aria-label="Zurück">←</button>
    <button class="back" data-a="fav" data-id="${r.id}" aria-label="Favorit" aria-pressed="${fav}">${fav ? '♥' : '♡'}</button></div>
    ${photo(r, 'hero')}${credit(r.id)}<span class="tag">${esc(r.cat)}</span>${offerTag(r)}<h1 style="margin-top:8px">${esc(r.title)}</h1>
    <div class="meta" style="font-size:14px;margin-bottom:16px"><span>⏱ ${fmtTime(r.time)}</span><span>👥 ${fmtServ(sv)} Portionen</span><span class="price">${eur(P.shareCost(r, p))}</span></div>
    ${P.eligible(r, p) ? '' : `<div class="card sand over">Passt nicht zu deinem Profil (Ernährung, Allergie, Abneigung oder Küchengerät).</div>`}
    <div class="card"><h3>Pro Portion</h3>${donut(r.m)}</div>
    <div class="card"><h3>Zutaten für ${fmtServ(sv)} Portionen</h3>${Object.entries(r.ing).map(([id, a]) => { const g = D.INGREDIENTS[id];
      return `<div class="ing"><span>${esc(g.name)}${P.packOf(id, p).was && !g.flags.includes('pantry') ? ' <span class="tag offer">Aktion</span>' : ''}</span><span class="muted">${fmtQty(a * sv, g.unit)}</span></div>`; }).join('')}</div>
    ${r.leftovers ? `<div class="card sand">🥡 <b>Gut für Reste:</b> ${p.fridge ? 'Hält 2–3 Tage im Kühlschrank. Aufwärmen mit einem Schuss Wasser bei mittlerer Hitze.' : 'Am besten frisch essen.'}${p.freezer ? ' Lässt sich portionsweise einfrieren.' : ''}</div>` : ''}
    <div class="card"><h3>Zubereitung</h3><ol style="padding-left:20px;margin:0">${r.steps.map(s => `<li style="margin-bottom:8px">${esc(s.x)}${s.t ? ` <span class="tag">⏱ ${fmtTime(s.t)}</span>` : ''}</li>`).join('')}</ol></div>
    <button class="btn small bring" data-a="bringrecipe" style="margin-bottom:12px">Zutaten in Bring! übernehmen</button>
    <div class="footer-cta"><button class="btn" data-a="cook">Loslegen</button></div>`;
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function vCook() {
  const r = R(ui.recipe), i = ui.cookStep, s = r.steps[i], last = i === r.steps.length - 1, key = r.id + ':' + i, tm = ui.timers[key];
  let timer = '';
  if (s.t) {
    const rem = !tm ? s.t * 60 : tm.paused != null ? tm.paused / 1000 : Math.max(0, (tm.end - Date.now()) / 1000);
    timer = `<button class="timer ${tm ? (rem ? 'run' : 'done') : ''}" data-a="timer" data-id="${key}" data-t="${s.t}">${!tm || tm.paused != null ? '▶' : rem ? '⏸' : '✓'} ${tm && !rem ? 'Fertig!' : mmss(rem)}</button>`;
  }
  return `<div class="cook" role="dialog" aria-label="Kochmodus"><div class="row between"><span>${esc(r.title)}</span><button class="back" style="background:rgba(255,255,255,.12);color:#fff" data-a="exitcook" aria-label="Schließen">✕</button></div>
    <div class="stepbody"><div class="muted" style="color:var(--gold)">Schritt ${i + 1} von ${r.steps.length}</div><p>${esc(s.x)}</p><div>${timer}</div>
    ${last && r.leftovers ? `<p class="muted" style="color:#e9d8bf;font-size:15px;font-family:var(--sans)">🥡 Reste in einer Dose abkühlen lassen und in den Kühlschrank stellen – aufwärmen bis alles dampfend heiß ist.</p>` : ''}</div>
    <div class="dots">${r.steps.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row"><button class="btn ghost" data-a="cstep" data-d="-1" ${i ? '' : 'disabled'}>Zurück</button><button class="btn" data-a="${last ? 'exitcook' : 'cstep'}" data-d="1">${last ? 'Fertig – Mahlzeit!' : 'Weiter'}</button></div></div>`;
}

// ---------- Einkaufsliste ----------
function listGroups() {
  const st = P.store(S.profile), items = cost().items;
  return st.aisleOrder.map((a, n) => ({ title: `${n + 1}. ${D.AISLES[a]}`, items: items.filter(i => i.ing.aisle === a).sort((x, y) => x.pantry - y.pantry || x.ing.name.localeCompare(y.ing.name)) }))
    .filter(g => g.items.length);
}
const itemLine = i => i.pantry ? `${i.ing.name} (Vorrat prüfen)` : `${i.ing.name} – ${i.packs}× ${i.pack}${i.product ? ` (${i.product})` : ''}${i.saved ? ` – AKTION${i.offer ? ' ' + offerWhen(i.offer) : ''}` : ''}`;
const fmtDate = iso => new Date(iso + 'T12:00').toLocaleDateString('de-AT');
const priceNote = st => {
  const rs = P.realStore({ store: st.id }), n = P.offers({ store: st.id }).length, akt = n ? ` · ${n} Aktionen` : '';
  if (!rs) return `Geschätzte Preise auf ${st.name}-Niveau`;
  return rs.offersOnly ? `Geschätzte Preise${akt}` : `Echte ${st.name}-Preise · Stand ${fmtDate(rs.asOf)}${akt}`;
};
// Aktions-Zeitraum, Händlerformat (z. B. INTERSPAR) und Kundenkarten-Hinweis
const offerWhen = o => {
  const d = iso => { const x = new Date(iso + 'T12:00'); return `${x.getDate()}.${x.getMonth() + 1}.`; }, today = new Date().toISOString().slice(0, 10);
  return [o.from > today ? `ab ${d(o.from)}` : '', `bis ${d(o.to)}`, o.adv, o.loyalty ? (/lidl/i.test(o.adv) ? 'nur mit Lidl Plus' : 'nur mit Kundenkarte/App') : ''].filter(Boolean).join(' · ');
};
function vList() {
  const st = P.store(S.profile), groups = listGroups(), all = [...groups.flatMap(g => g.items.map(i => i.id)), ...S.extras.map(e => 'x:' + e)];
  const done = all.filter(id => S.checked[id]).length;
  const row = (id, name, sub) => `<button class="item" role="checkbox" aria-checked="${!!S.checked[id]}" data-a="check" data-id="${esc(id)}"><span class="box">${S.checked[id] ? '✓' : ''}</span><span class="grow"><span class="name">${esc(name)}</span>${sub ? `<div class="muted">${sub}</div>` : ''}</span></button>`;
  return `<div class="row between" style="margin-bottom:12px"><button class="back" data-a="go" data-id="plan" aria-label="Zurück">←</button><span class="badge" style="background:${st.color}">${st.name}</span></div>
    <h1>Einkaufsliste</h1><div class="row between muted"><span>${done}/${all.length} erledigt</span><span>${eur(cost().total)}</span></div>
    <div class="progress" style="margin:8px 0 16px"><i style="width:${all.length ? done / all.length * 100 : 0}%;background:var(--sage)"></i></div>
    <div class="row"><button class="btn small ghost grow" data-a="copy">📋 Liste kopieren</button><button class="btn small ghost grow" data-a="share">↗ Teilen</button></div>
    <button class="btn small bring" data-a="bringlist">In Bring! übernehmen</button>
    ${groups.map(g => `<div class="aisle-title">${g.title}</div>${g.items.map(i => row(i.id, i.pantry ? i.ing.name : `${i.ing.name}`, i.pantry ? 'Vorrat prüfen · nicht im Preis' : `${i.packs}× ${esc(i.pack)} · ${eur(i.cost)}${i.saved ? ` · <span class="offer-text">🏷 Aktion statt ${eur(i.cost + i.saved)}${i.offer ? ` (${esc(offerWhen(i.offer))})` : ''}</span>` : ''}${i.product ? `<br>${esc(i.product)}` : ' · geschätzt'}`)).join('')}`).join('')}
    <div class="aisle-title">Eigene Einkäufe</div>
    ${S.extras.map((e, n) => `<div class="row">${row('x:' + e, e)}<button class="back" data-a="rmextra" data-i="${n}" aria-label="${esc(e)} entfernen">✕</button></div>`).join('')}
    <form class="row" data-f="extra" style="margin-top:12px"><input name="x" placeholder="z. B. Kaffee, Klopapier" aria-label="Artikel" maxlength="80"><button class="btn small">+ Hinzufügen</button></form>
    <p class="muted" style="margin-top:16px">${priceNote(st)}, jeweils ganze Packungen. Echte Preise via heisse-preise.io, ohne Gewähr – Aktionen und Filialpreise können abweichen. Einwegpfand (Getränke) ist nicht enthalten.</p>
    ${done ? `<button class="btn ghost" data-a="uncheck" style="margin-top:8px">Häkchen zurücksetzen</button>` : ''}`;
}
// Bring! liest nur serverseitiges schema.org-Rezept-Markup (kein JS). Die Seite wird daher als Base64 in einer
// httpbin.org-URL verpackt, die genau dieses HTML ausliefert; Bring! öffnet dann seinen Import-Dialog.
// shortcut: hängt an httpbin.org – bei Ausfällen eigenen Mini-Endpoint (z. B. Cloudflare Worker) nehmen.
function bringUrl(title, lines) {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Recipe', name: title, recipeYield: '1', recipeIngredient: lines }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><script type="application/ld+json">${ld}</script></head><body><h1>${esc(title)}</h1></body></html>`;
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(html))).replace(/\+/g, '-').replace(/\//g, '_');
  return `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent('https://httpbin.org/base64/' + b64)}&source=web&baseQuantity=1&requestedQuantity=1`;
}
const shortName = ing => ing.name.replace(/ \(.*\)/, '');
function bringListLines() {
  const items = listGroups().flatMap(g => g.items).filter(i => !i.pantry && !S.checked[i.id]);
  return [...items.map(i => `${shortName(i.ing)}, ${i.packs}× ${i.pack}`), ...S.extras.filter(e => !S.checked['x:' + e])];
}

function listText() {
  return `Einkaufsliste – ${P.store(S.profile).name}\n` + listGroups().map(g => `\n${g.title}\n` + g.items.map(i => `${S.checked[i.id] ? '☑' : '☐'} ${itemLine(i)}`).join('\n')).join('\n')
    + (S.extras.length ? `\n\nEigene Einkäufe\n` + S.extras.map(e => `${S.checked['x:' + e] ? '☑' : '☐'} ${e}`).join('\n') : '');
}

// ---------- Entdecken ----------
function discoverList() {
  const q = ui.q.trim().toLowerCase(), p = S.profile;
  const rs = recipes().filter(r => (ui.filter === 'alle' || (ui.filter === 'fav' && S.favs.includes(r.id)) || (ui.filter === 'passt' && P.eligible(r, p)) || (ui.filter === 'eigene' && r.custom))
    && (!q || (r.title + ' ' + r.cat + ' ' + Object.keys(r.ing).map(i => D.INGREDIENTS[i].name).join(' ')).toLowerCase().includes(q)));
  return rs.length ? rs.map(r => `<div class="card day"><button style="display:contents" data-a="recipe" data-id="${r.id}">${photo(r)}<div class="grow" style="text-align:left"><span class="tag">${esc(r.cat)}</span>${offerTag(r)}
    <h3>${esc(r.title)}</h3><div class="meta"><span>⏱ ${fmtTime(r.time)}</span><span>${r.m[0]} kcal</span><span class="price">${eur(P.shareCost(r, p))}</span></div></div></button>
    <button class="swap" data-a="fav" data-id="${r.id}" aria-label="Favorit" aria-pressed="${S.favs.includes(r.id)}">${S.favs.includes(r.id) ? '♥' : '♡'}</button></div>`).join('') : '<p class="muted">Keine Rezepte gefunden.</p>';
}
function vDiscover() {
  if (ui.form) return vForm();
  return `<div class="row between"><h1>Entdecken</h1><button class="btn small" data-a="newrecipe">+ Eigenes Rezept</button></div>
    <input type="search" placeholder="Rezept oder Zutat suchen …" value="${esc(ui.q)}" data-i="q" aria-label="Suche" style="margin:8px 0 12px">
    <div class="chips" style="margin-bottom:12px">${[['alle', 'Alle'], ['passt', 'Passt zu mir'], ['fav', '♥ Favoriten'], ['eigene', 'Eigene']].map(([id, l]) => `<button class="chip" ${sel(ui.filter === id)} data-a="filter" data-id="${id}">${l}</button>`).join('')}</div>
    <div id="dlist">${discoverList()}</div>`;
}
function vForm() {
  const f = ui.form, opts = Object.values(D.INGREDIENTS).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="row" style="margin-bottom:12px"><button class="back" data-a="cancelform" aria-label="Zurück">←</button><h2 style="margin:0">Eigenes Rezept</h2></div>
    <form data-f="recipe">
      <label class="muted">Titel</label><input name="title" required maxlength="60" value="${esc(f.title)}" style="margin-bottom:10px">
      <div class="row"><div class="grow"><label class="muted">Emoji</label><input name="emoji" maxlength="4" value="${esc(f.emoji)}"></div>
        <div class="grow"><label class="muted">Zeit (Min.)</label><input name="time" type="number" min="1" max="600" required value="${f.time}"></div></div>
      <label class="muted" style="display:block;margin-top:10px">Stil</label><select name="tag">${D.STYLES.map(([id, l]) => `<option value="${id}" ${f.tag === id ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <h3 style="margin-top:16px">Zutaten (pro Portion)</h3>
      ${f.ing.map((x, n) => `<div class="row" style="margin-bottom:8px"><select name="ing${n}" class="grow">${opts.map(o => `<option value="${o.id}" ${x.id === o.id ? 'selected' : ''}>${esc(o.name)} (${o.unit})</option>`).join('')}</select>
        <input name="amt${n}" type="number" min="0" step="any" value="${x.amt}" style="width:90px" aria-label="Menge"><button type="button" class="back" data-a="rmrow" data-i="${n}" aria-label="Zeile entfernen">✕</button></div>`).join('')}
      <button type="button" class="btn small ghost" data-a="addrow">+ Zutat</button>
      <h3 style="margin-top:16px">Schritte</h3><p class="muted">Ein Schritt pro Zeile. „… 10 Min. …“ erzeugt automatisch einen Timer.</p>
      <textarea name="steps" rows="6" required>${esc(f.steps)}</textarea>
      <h3 style="margin-top:16px">Nährwerte pro Portion (optional)</h3>
      <div class="row">${['kcal', 'Eiweiß', 'KH', 'Fett'].map((l, n) => `<div class="grow"><label class="muted">${l}</label><input name="m${n}" type="number" min="0" value="${f.m[n]}"></div>`).join('')}</div>
      <button class="btn" style="margin-top:20px">Rezept speichern</button></form>`;
}
function readForm(form) {
  const fd = new FormData(form), f = ui.form;
  f.title = fd.get('title'); f.emoji = fd.get('emoji'); f.time = +fd.get('time'); f.tag = fd.get('tag'); f.steps = fd.get('steps');
  f.ing = f.ing.map((_, n) => ({ id: fd.get('ing' + n), amt: +fd.get('amt' + n) || 0 }));
  f.m = [0, 1, 2, 3].map(n => +fd.get('m' + n) || 0);
}

// ---------- Profil ----------
function vProfile() {
  const p = S.profile, lbl = (arr, ids) => ids.map(id => arr.find(x => x[0] === id)?.[1]).join(', ') || '–';
  const rows = [
    [0, 'Supermarkt', P.store(p).name], [1, 'Haushalt', `${p.adults} Erwachsene${p.kids.on ? `, ${p.kids.count} Kind(er) ${p.kids.age} J.` : ''}`],
    [2, 'Mahlzeiten', [p.meals.lunch && 'Mittag', p.meals.dinner && 'Abend'].filter(Boolean).join(' & ')], [3, 'Wochenbudget', eur(p.budget, 0)],
    [4, 'Appetit', lbl(D.STYLES, p.styles)], [5, 'Ernährung', lbl(D.DIETS, [p.diet])], [6, 'Abneigungen', lbl(D.DISLIKES, p.dislikes)],
    [7, 'Allergien', p.allergies.length ? `${lbl(D.ALLERGENS, p.allergies)} (${p.allergyMode === 'strict' ? 'streng' : 'vermeiden'})` : '–'],
    [8, 'Küche', lbl(D.EQUIPMENT, p.equipment)],
  ];
  return `<h1>Profil</h1><p class="muted">Alles bleibt lokal auf diesem Gerät – kein Konto nötig.</p>
    <div class="card">${rows.map(([n, l, v]) => `<button class="toggle" style="width:100%;text-align:left" data-a="edit" data-i="${n}"><div><b>${l}</b><div class="muted">${esc(v)}</div></div><span aria-hidden="true">›</span></button>`).join('')}</div>
    <div class="card"><b>Feste Kochpause-Tage</b><div class="muted" style="margin-bottom:10px">An diesen Wochentagen kochst du immer selbst – sie werden nicht verplant.</div>
      <div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(n => `<button class="chip" ${sel((p.skipDays || []).includes(n))} data-a="skipday" data-id="${n}">${WD[n].slice(0, 2)}</button>`).join('')}</div></div>
    <button class="btn ghost" data-a="reset">Alle Daten löschen</button>`;
}

// ---------- Rendering ----------
const TABS = [['plan', '🗓', 'Plan'], ['discover', '🔎', 'Entdecken'], ['profile', '👤', 'Profil']];
function render() {
  const v = ui.view, app = document.getElementById('app');
  const body = { onboarding: vOnboarding, plan: vPlan, list: vList, recipe: vRecipe, discover: vDiscover, profile: vProfile }[v === 'cook' ? 'recipe' : v]();
  const tabs = ['plan', 'discover', 'profile'].includes(v) ? `<nav class="tabs">${TABS.map(([id, ic, l]) => `<button data-a="go" data-id="${id}" ${v === id ? 'aria-current="page"' : ''}><span>${ic}</span>${l}</button>`).join('')}</nav>` : '';
  app.innerHTML = body + tabs + (ui.sheet ? vSwapSheet() : '') + (v === 'cook' ? vCook() : '');
}
function rerender(scrollTop) { render(); if (scrollTop) scrollTo(0, 0); }

let toastT;
function toast(msg, action, label) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button data-a="${action}">${label}</button>` : ''}`;
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 7000 : 3000);
}

function regenerate() { S.plan = P.planWeek(S.profile, recipes(), S.plan); S.checked = {}; save(); }

// ---------- Kochmodus: Wake Lock & Timer ----------
let wake = null, tick = null, audio;
async function lockScreen() { try { wake = await navigator.wakeLock?.request('screen'); } catch { /* nicht unterstützt */ } }
document.addEventListener('visibilitychange', () => { if (ui.view === 'cook' && document.visibilityState === 'visible') lockScreen(); });
function beep() {
  try { audio ||= new AudioContext(); const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination);
    o.frequency.value = 880; g.gain.setValueAtTime(.3, audio.currentTime); o.start(); o.stop(audio.currentTime + .8); } catch { /* stumm */ }
  navigator.vibrate?.([300, 150, 300]);
}
function ensureTick() {
  if (tick) return;
  tick = setInterval(() => {
    const active = Object.values(ui.timers).filter(t => !t.done);
    for (const t of active) if (Date.now() >= t.end) { t.done = true; beep(); toast('⏰ Timer abgelaufen!'); }
    if (!active.length) { clearInterval(tick); tick = null; }
    if (ui.view === 'cook') render();
  }, 1000);
}

// ---------- Aktionen ----------
const toggleIn = (arr, id, max) => arr.includes(id) ? arr.filter(x => x !== id) : (max && arr.length >= max ? arr : [...arr, id]);
const A = {
  store: d => { ui.draft.store = d.id; },
  adults: d => { ui.draft.adults = Math.min(8, Math.max(1, ui.draft.adults + +d.d)); },
  kids: () => { ui.draft.kids.on = !ui.draft.kids.on; },
  kidcount: d => { ui.draft.kids.count = Math.min(6, Math.max(1, ui.draft.kids.count + +d.d)); },
  kidage: d => { ui.draft.kids.age = d.id; },
  meal: d => { ui.draft.meals[d.id] = !ui.draft.meals[d.id]; },
  style: d => { const before = ui.draft.styles.length; ui.draft.styles = toggleIn(ui.draft.styles, d.id, 3); if (before === 3 && ui.draft.styles.length === 3) toast('Maximal 3 auswählen'); },
  diet: d => { ui.draft.diet = d.id; },
  dislike: d => { ui.draft.dislikes = toggleIn(ui.draft.dislikes, d.id); },
  eatall: () => { ui.draft.dislikes = []; },
  allergy: d => { ui.draft.allergies = toggleIn(ui.draft.allergies, d.id); },
  amode: d => { ui.draft.allergyMode = d.id; },
  equip: d => { ui.draft.equipment = toggleIn(ui.draft.equipment, d.id); },
  store2: d => { ui.draft[d.id] = !ui.draft[d.id]; },
  obback: () => { if (ui.editing) { ui.editing = false; ui.view = 'profile'; } else ui.step--; },
  obnext: () => {
    const p = ui.draft;
    if (ui.step === 1 || ui.step === 2) p.budget = Math.min(budgetMax(p), p.budget);
    if (ui.editing) {
      const onlyStore = ui.step === 0;
      S.profile = p; ui.editing = false; ui.view = 'profile';
      if (onlyStore) { save(); toast(`Preise & Gänge für ${P.store(p).name} neu berechnet`); }
      else { regenerate(); toast('Profil gespeichert – Plan neu erstellt'); }
      return;
    }
    if (ui.step === 2) p.budget = Math.max(20, Math.min(budgetMax(p), Math.round(P.servings(p) * 7 * (+p.meals.lunch + +p.meals.dinner) * 2.5 / 5) * 5));
    if (ui.step < STEPS.length - 1) { ui.step++; return; }
    S.profile = p; S.onboarded = true; regenerate(); ui.view = 'plan';
  },
  go: d => { ui.view = d.id; ui.sheet = null; ui.form = null; },
  regen: () => { regenerate(); toast('Neuer Wochenplan erstellt'); },
  rebalance: () => {
    const before = cost().total; S.plan = P.rebalance(S.plan, -1, S.profile, recipes()); save();
    const after = cost().total; toast(after <= S.profile.budget ? `Ausgeglichen: ${eur(before - after)} gespart` : 'Budget sehr knapp – günstigste Kombination gewählt');
  },
  swap: d => { ui.sheet = { i: +d.i }; },
  closesheet: (d, e) => { if (e.target.closest('[data-stop]') && !e.target.closest('button[data-a="closesheet"]')) return false; ui.sheet = null; },
  skip: d => {
    const i = ui.sheet.i, note = d.id === 'self' ? document.getElementById('selfnote').value.trim() : '';
    S.plan[i] = { date: S.plan[i].date, meal: S.plan[i].meal, rid: null, skip: d.id, note }; ui.sheet = null; save();
    toast(d.id === 'self' ? 'Ausgesetzt – du kochst selbst' : 'Ausgesetzt – freier Abend');
  },
  skipday: d => {
    const n = +d.id; S.profile.skipDays = toggleIn(S.profile.skipDays || [], n);
    // Weggenommener fester Tag: dessen Selbstkoch-Slots wieder freigeben, damit neu geplant wird
    if (!S.profile.skipDays.includes(n)) S.plan = S.plan.map(s => s.skip === 'self' && !s.note && new Date(s.date + 'T12:00').getDay() === n ? { date: s.date, meal: s.meal, rid: null } : s);
    regenerate(); toast(S.profile.skipDays.includes(n) ? `${WD[n]}s kochst du ab jetzt selbst` : `${WD[n]} wird wieder eingeplant`);
  },
  pick: d => {
    const i = ui.sheet.i; S.plan[i] = { date: S.plan[i].date, meal: S.plan[i].meal, rid: d.id || null, ...(d.id ? {} : { skip: 'free' }) }; ui.sheet = null; save();
    const t = cost().total;
    if (t > S.profile.budget) { ui.lastSwap = i; toast(`${eur(t - S.profile.budget)} über Budget`, 'autofix', 'Andere Tage anpassen'); }
    else toast(`Getauscht · Woche jetzt ${eur(t)}`);
  },
  autofix: () => { S.plan = P.rebalance(S.plan, ui.lastSwap, S.profile, recipes()); save(); document.getElementById('toast').classList.remove('show');
    toast(cost().total <= S.profile.budget ? 'Andere Tage angepasst – wieder im Budget' : 'Günstigste mögliche Kombination gewählt'); },
  recipe: d => { ui.back = ['plan', 'discover'].includes(ui.view) ? ui.view : 'plan'; ui.recipe = d.id; ui.view = 'recipe'; return 'top'; },
  fav: d => { S.favs = toggleIn(S.favs, d.id); save(); },
  cook: () => { ui.view = 'cook'; ui.cookStep = 0; lockScreen(); },
  exitcook: () => { ui.view = 'recipe'; wake?.release?.(); wake = null; },
  cstep: d => { ui.cookStep = Math.max(0, Math.min(R(ui.recipe).steps.length - 1, ui.cookStep + +d.d)); },
  timer: d => {
    const t = ui.timers[d.id];
    if (!t || t.done) ui.timers[d.id] = { end: Date.now() + d.t * 60000, done: false };
    else if (t.paused != null) { t.end = Date.now() + t.paused; t.paused = null; }
    else { t.paused = t.end - Date.now(); t.end = Infinity; }
    audio ||= (window.AudioContext ? new AudioContext() : null); // auf Nutzergeste entsperren
    ensureTick();
  },
  check: d => { S.checked[d.id] = !S.checked[d.id]; save(); },
  uncheck: () => { S.checked = {}; save(); },
  rmextra: d => { S.extras.splice(+d.i, 1); save(); },
  copy: async () => { try { await navigator.clipboard.writeText(listText()); toast('Liste kopiert'); } catch { toast('Kopieren nicht möglich'); } return false; },
  bringlist: () => {
    const lines = bringListLines();
    if (!lines.length) { toast('Alles erledigt – nichts zu übertragen'); return false; }
    location.href = bringUrl(`Piatto Einkaufsliste ${P.store(S.profile).name}`, lines); return false;
  },
  bringrecipe: () => {
    const r = R(ui.recipe), sv = P.servings(S.profile);
    const lines = Object.entries(r.ing).filter(([id]) => !D.INGREDIENTS[id].flags.includes('pantry')).map(([id, a]) => `${shortName(D.INGREDIENTS[id])}, ${fmtQty(a * sv, D.INGREDIENTS[id].unit)}`);
    location.href = bringUrl(r.title, lines); return false;
  },
  share: async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Einkaufsliste', text: listText() }); } catch { /* abgebrochen */ } }
    else await A.copy();
    return false;
  },
  filter: d => { ui.filter = d.id; },
  offer: d => { ui.q = D.INGREDIENTS[d.id].name.replace(/ \(.*\)/, ''); ui.filter = 'passt'; ui.view = 'discover'; return 'top'; },
  newrecipe: () => { ui.form = { title: '', emoji: '🍽️', time: 30, tag: 'schnell', ing: [{ id: 'zwiebel', amt: 50 }], steps: '', m: [500, 20, 60, 15] }; },
  cancelform: () => { ui.form = null; },
  addrow: () => { readForm(document.querySelector('[data-f="recipe"]')); ui.form.ing.push({ id: 'erdaepfel', amt: 100 }); },
  rmrow: d => { readForm(document.querySelector('[data-f="recipe"]')); ui.form.ing.splice(+d.i, 1); },
  edit: d => { ui.draft = structuredClone(S.profile); ui.step = +d.i; ui.editing = true; ui.view = 'onboarding'; },
  reset: () => { if (!confirm('Wirklich alle Daten (Plan, Liste, eigene Rezepte) löschen?')) return false; localStorage.removeItem(KEY); location.reload(); },
};

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  if (el.tagName !== 'BUTTON' || el.type !== 'submit') e.preventDefault();
  const r = await A[el.dataset.a]?.(el.dataset, e);
  if (r === false) return;
  rerender(r === 'top' || ['go', 'obnext', 'obback', 'edit', 'newrecipe'].includes(el.dataset.a));
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('svg [data-a]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); }
});
document.addEventListener('input', e => {
  const k = e.target.dataset.i;
  if (k === 'budget') {
    const p = ui.draft; p.budget = +e.target.value;
    document.getElementById('budgetval').textContent = eur(p.budget, 0);
    document.getElementById('perserv').textContent = eur(p.budget / (7 * ((+p.meals.lunch) + (+p.meals.dinner)) * P.servings(p)));
  }
  if (k === 'q') { ui.q = e.target.value; document.getElementById('dlist').innerHTML = discoverList(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.f === 'extra') {
    const x = new FormData(f).get('x').trim();
    if (x && !S.extras.includes(x)) { S.extras.push(x); save(); }
  }
  if (f.dataset.f === 'recipe') {
    readForm(f);
    const v = ui.form, ing = {};
    for (const { id, amt } of v.ing) if (D.INGREDIENTS[id]) ing[id] = (ing[id] || 0) + amt;
    if (!Object.keys(ing).length) { toast('Mindestens eine Zutat angeben'); return; }
    const steps = v.steps.split('\n').map(s => s.trim()).filter(Boolean).map(x => { const m = x.match(/(\d+)\s*(Min|Std)/i); return { x, t: m ? +m[1] * (/std/i.test(m[2]) ? 60 : 1) : undefined }; });
    const tags = [v.tag]; if (v.time <= 25) tags.push('schnell');
    S.custom.push({ id: 'c' + Date.now(), custom: true, title: v.title.trim(), emoji: v.emoji || '🍽️', hue: Math.floor(Math.random() * 360), cat: D.STYLES.find(s => s[0] === v.tag)[1],
      time: v.time, tags, needs: [], m: v.m, ing, steps });
    ui.form = null; ui.filter = 'eigene'; save(); toast('Rezept gespeichert – wird ab jetzt mitgeplant');
  }
  render();
});

if (ui.view === 'onboarding') ui.draft = structuredClone(S.profile);
// Echte Preise laden; ohne Datei (z. B. file://) bleiben die Schätzungen.
const getJSON = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
Promise.all([getJSON('prices.json'), getJSON('img/credits.json')]).then(([pr, cr]) => {
  if (pr) P.setPrices(pr);
  CREDITS = cr || {};
  // planVersion 2: alte Pläne mit doppelten Rezepten einmalig neu erstellen
  if (S.onboarded && (!S.plan.length || S.planVersion !== 2)) { regenerate(); S.planVersion = 2; save(); }
  render();
});
