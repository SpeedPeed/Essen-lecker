# Masterprompt: Piatto – systematische Analyse & Verbesserung

> In eine neue Claude-Code-Sitzung auf diesem Repo (`speedpeed/Essen-lecker`) einfügen.

---

Du übernimmst **Piatto**, einen budgetbasierten Wochen-Essensplaner für Österreich (österreichisches Deutsch, Mobile-First, Local-First ohne Login). Live: https://speedpeed.github.io/Essen-lecker/ (GitHub Pages vom aktuellen Branch). Deine Aufgabe: **erst alles systematisch durchschauen und bewerten, dann die wichtigsten Schwächen beheben** – gründlich, getestet, ohne Funktionen kaputtzumachen.

## Projektstand (kurz)
- **Kein Build-Schritt**: `index.html`, `styles.css`, `data.js` (Zutaten, Märkte, 58 Rezepte), `planner.js` (reine Planungslogik, läuft auch in Node), `app.js` (UI, String-Templates + Event-Delegation, State in `localStorage` unter `piatto.v1`).
- **Preise**: `scripts/prices.js` ordnet Zutaten per Regex echten Produkten von heisse-preise.io zu (nur BILLA tagesaktuell, SPAR Stand 09/2026); `scripts/offers.js` holt Flugblatt-Aktionen von marktguru.at (inoffizielle API, Schlüssel aus deren Website, PLZ fix 1010). Ergebnis: `prices.json`. GitHub Action `.github/workflows/prices.yml` aktualisiert täglich.
- **Bilder**: `img/*.jpg` von Openverse (CC), Nachweise in `img/credits.json`.
- **Bring!-Export** über httpbin.org-Umweg (Bring! liest nur serverseitiges schema.org-Markup).
- **Tests**: `node test.js` (nur Planer/Preise/Aktionen). Browser-Tests liegen bisher nicht im Repo.

## Phase 1 – Analyse (noch nichts ändern)
1. Lies **jede Datei vollständig**. Starte die App lokal (`python3 -m http.server`) und klicke sie mit Playwright durch (390×844 und Desktop), inkl. Screenshots.
2. Spiele **mindestens 5 Personas** komplett durch: Single mit 25 €, Familie 2+2 Kinder mit 120 €, Veganerin mit strenger Gluten-Allergie, SPAR-Stammkundin mit Mittag+Abend, jemand ohne Backrohr/mit nur Mikrowelle. Prüfe jeweils: Plan sinnvoll und abwechslungsreich? Budget realistisch? Einkaufsliste korrekt (Mengen, Packungen, Gänge)? Filter wirklich eingehalten?
3. Bewerte entlang dieser Achsen und belege jeden Befund mit Datei:Zeile, Screenshot oder Testausgabe:
   - **Korrektheit**: Planer-Logik, Packungsberechnung, Portionen (Kinderfaktoren), Datum/Wochenwechsel, Swap/Rebalance, Aussetzen, Aktionsgültigkeit.
   - **Datenqualität**: Rezeptmengen und Nährwerte (plausibel? pro Portion?), Schrittanleitungen, Zutaten-Flags (Allergene/Diäten vollständig?), Preis-Zuordnung (`node scripts/prices.js` laufen lassen und alle Treffer pro Markt sichten – falsche Produkte, unpassende Packungsgrößen), Fotos passend?
   - **UX & Design**: Verständlichkeit, Leerzustände, Fehlermeldungen, Feedback, Ladezustände, Touch-Ziele, Lesbarkeit, Konsistenz mit dem „Organic Editorial“-Design.
   - **Barrierefreiheit**: Tastatur, Screenreader-Labels, Kontraste, Fokus, `prefers-reduced-motion`.
   - **Robustheit**: kaputter/alter localStorage-State, fehlende `prices.json`, Offline, externe Dienste down (heisse-preise, marktguru, Openverse, httpbin, Bring!), sehr kleine Rezeptpools.
   - **Sicherheit & Datenschutz**: XSS über eigene Rezepte/Artikel/externe Produktnamen, was an Dritte geht (httpbin/Bring!), Lizenzen/Nachweise der Bilder, rechtliche Risiken der Datenquellen.
   - **Code & Wartbarkeit**: Größe/Struktur von `app.js`, Duplikate, toter Code, Testabdeckung, CI.
   - **Performance**: Planungsdauer auf schwachem Handy, Bildgrößen, Render-Kosten.
4. Liefere einen **priorisierten Befundbericht** (kritisch / wichtig / nice-to-have), jeweils mit Auswirkung für Nutzer:innen und Aufwand. Schreib ihn nach `docs/REVIEW.md`.

**Bekannte Schwachstellen, die du verifizieren und einordnen sollst** (nicht blind übernehmen):
- Woche startet „heute“ statt Montag; Plan rollt nicht automatisch in die neue Woche; „Neu planen“ setzt Häkchen zurück.
- „Mittagessen – gut mit Resten“ ist nur ein Scoring-Bonus, kein echtes Reste-Konzept (Abend kochen → Mittag am nächsten Tag).
- Stück-Einheiten wirken inkonsistent (z. B. Knoblauch „Zehe“ vs. Packung „Knollen“).
- Nährwerte und Mengen der Rezepte sind geschätzt; 8 Rezepte ohne Foto, einige Fotos nur ungefähr passend.
- Preis-Regexe sind fragil; HOFER/LIDL-Regalpreise nur geschätzt; Aktionen nur für PLZ 1010; Gang-Reihenfolgen der Märkte erfunden.
- Eigene Rezepte: kein Bearbeiten/Löschen; kein Export/Backup der lokalen Daten; kein Teilen zwischen Geräten.
- Keine PWA (Manifest/Service Worker/Offline), kein Dark Mode, Desktop-Layout rudimentär.
- Ganze App wird per `innerHTML` neu gerendert (Scroll-/Fokusverlust?).
- Pages läuft vom Feature-Branch statt `main`.

## Phase 2 – Verbessern
1. Arbeite den Bericht **von oben nach unten** ab. Bei Entscheidungen mit Produkt-Tragweite (neue externe Dienste, Konten, Datenmodell-Brüche, Entfernen von Funktionen) **frag mich vorher** – sonst entscheide selbst.
2. Pro Verbesserung: kleinster vollständiger Fix, bestehende Struktur respektieren (kein Framework, kein Build), Daten-Migration für bestehende `localStorage`-Stände mitdenken.
3. **Tests**: Für jede Logik-Änderung einen Test in `test.js`. Lege zusätzlich einen Playwright-Smoke-Test ins Repo (z. B. `tests/e2e.js`), der Onboarding → Plan → Swap/Aussetzen → Rezept/Kochmodus → Einkaufsliste → Profil durchläuft und Konsolenfehler meldet; bau ihn in die GitHub Action ein.
4. Nach jedem größeren Block: Tests + Screenshots prüfen, committen (aussagekräftige deutsche Commit-Messages), pushen.

## Abschluss
- `docs/REVIEW.md` um eine Spalte „Status“ ergänzen (behoben / offen / bewusst nicht gemacht + Grund).
- Kurze Zusammenfassung für mich: was besser ist, was offen bleibt, welche Risiken bestehen (v. a. externe Datenquellen), und was du als Nächstes empfehlen würdest.
