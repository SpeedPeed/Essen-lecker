# Piatto – Review (22.11.2026)

Grundlage: alle Dateien gelesen, 5 Personas mit echter `prices.json` durch den Planer gespielt (Skript-Ausgabe unten), App mit Playwright bei 390×844 und 1280×900 durchgeklickt (`tests/e2e.js`, Screenshots lokal), `prices.json` je Markt gesichtet.

## Personas (Planer, Start Mo 23.11.)

| Persona | Rezepte im Pool | Kosten / Budget | Auffällig |
|---|---|---|---|
| Single, 25 €, HOFER | 53 | 25,54 / 25 | knapp über Budget, sonst abwechslungsreich |
| Familie 2+2 (4–10 J.), 120 €, BILLA, Mittag+Abend | 53 | 77,90 / 120 | **2× Knoblauch-Netz für 4 Zehen**; Chili con + sin Carne am selben Tag |
| Vegan + Gluten streng, LIDL | 5 | 28,84 / 40 | Wiederholungen ohne Erklärung; Suppenwürfel/Currypaste können Gluten/Garnelen enthalten |
| SPAR, 2 P., Mittag+Abend, 90 € | 53 | 76,81 / 90 | **Grana-Padano-Aktion 350 g um 7,99 €** ersetzt 100-g-Stück für 140 g Bedarf; 2 Knödelgerichte an einem Tag |
| Nur Mikrowelle, 30 € | 3 | 19,53 / 30 | 3 Gerichte rotieren, kein Hinweis warum |

Filter (Ernährung, strenge Allergien, Geräte) wurden in allen Läufen eingehalten.

## Befunde

Aufwand: S < 1 h, M ≈ halber Tag, L > 1 Tag.

### Kritisch

| # | Befund | Beleg | Auswirkung | Aufwand | Status |
|---|---|---|---|---|---|
| K1 | Alter/kaputter `localStorage`-Stand (fehlende Profilfelder, kaputte Slots) lässt die App beim Start abstürzen – leere Seite. | `app.js:14` (flaches `Object.assign`), e2e-Lauf: Timeout nach präpariertem State | Nutzer:in sieht nur weiße Seite, einziger Ausweg wäre Browserdaten löschen | S | behoben: Profil/Plan werden beim Laden mit Defaults zusammengeführt und bereinigt (e2e-Test) |
| K2 | Plan rollt nie in die neue Woche: ein Plan von letzter Woche bleibt für immer stehen. | `app.js:542` regeneriert nur bei leerem Plan/alter Version | Liste und Plan zeigen vergangene Tage | S | behoben: Ist der letzte Plantag vorbei, wird beim Öffnen automatisch neu geplant (Aussetz-Tage/Kochpausen bleiben), Häkchen werden dann zurückgesetzt |
| K3 | Datum per `toISOString()` (UTC): zwischen 0 und 1 Uhr (Sommer 2 Uhr) beginnt die Woche „gestern“; Aktions-„ab“-Anzeige ebenso. | `planner.js:83`, `app.js:257` | falscher Wochentag/Startdatum | S | behoben: lokales Datum (`isoDay`), Test in `test.js` |
| K4 | Knoblauch: Packung „3er-Netz Knollen“ wird als 3 Zehen gerechnet → ab 4 Zehen 2 Netze, echte SPAR-Einzelknolle ebenso als 3 Zehen. | `data.js` `knoblauch`, `planner.js:42`, Screenshot Liste „2× 3er-Netz“ | Liste und Budget falsch | S | behoben: 1 Knolle ≈ 10 Zehen (Netz = 30), echte Knollen-Anzahl wird umgerechnet; Test |
| K5 | Leerer Rezeptpool (z. B. vegan + streng Gluten + nur Mikrowelle) zeigt 7× „Freier Abend“ statt Hinweis; Leermeldung greift nie. | `app.js:135` prüft `!S.plan.length` | Nutzer:in versteht nicht, warum nichts geplant ist | S | behoben: Hinweis bei leerem Pool; bei sehr kleinem Pool Hinweis auf Wiederholungen |

### Wichtig

| # | Befund | Beleg | Auswirkung | Aufwand | Status |
|---|---|---|---|---|---|
| W1 | Flugblatt-Aktionen dürfen 2× größer als die Regel-Packung sein → teure Großpackung ersetzt die passende (Grana 350 g 7,99 €, LIDL Garnelen 720 g, Faschiertes 1 kg). | `scripts/offers.js` `pk.q > max * 2`, Persona SPAR | Wochenpreis steigt durch „Aktion“ | S | behoben: gleiche Mengenspanne wie Regalprodukte (wirkt ab nächstem Preis-Lauf) |
| W2 | Preis-Regel Bergkäse fällt auf „käse.*gerieben“ zurück und trifft „Clever Cheddar Käse gerieben“ (BILLA). Apfelmus trifft Bio-Marke Alnatura. | `prices.json`, `scripts/prices.js:40` | falsches Produkt in der Liste | S | behoben: Cheddar/Gouda/Pizzakäse ausgeschlossen, Alnatura in Bio-Ausschluss |
| W3 | Fokus geht bei jedem Klick verloren (ganze App per `innerHTML`); Tastatur/Screenreader landen am Seitenanfang. Scroll bleibt erhalten. | `app.js:360`, e2e-Fokusprüfung | Liste per Tastatur kaum bedienbar | S | behoben: Fokus wird nach dem Rendern auf das gleiche Element gesetzt (e2e) |
| W4 | Eigene Rezepte weder bearbeitbar noch löschbar; kein Export/Backup der lokalen Daten. | `app.js` `newrecipe`/Submit | Tippfehler bleiben für immer; Gerätewechsel = Datenverlust | M | behoben: Bearbeiten/Löschen im Rezept, Export/Import als JSON im Profil |
| W5 | „Mittagessen – gut mit Resten“ ist nur +1 Scoring-Bonus, kein Reste-Konzept. | `planner.js:122`, Onboarding-Text | Versprechen nicht eingelöst | M | behoben (minimal): Mittags-Slot lässt sich im Tausch-Sheet auf „Reste vom Vorabend“ setzen – Zutaten werden für doppelte Menge eingekauft, Rezept nicht doppelt gezählt; Onboarding-Text angepasst. Automatische Reste-Planung bewusst nicht (Produktentscheidung) |
| W6 | Strenge Allergien: Suppenwürfel (Sellerie, oft Gluten), rote Currypaste (teils Garnelenpaste) nicht als Risiko markiert; Sellerie fehlt als Allergen. | `data.js` `bruehe`, `currypaste`, `ALLERGENS` | Gesundheitsrisiko bei Vertrauen auf „streng“ | S | behoben: Sellerie als Allergen + Flag am Suppenwürfel; Hinweis „Etiketten prüfen“ bei strengen Allergien |
| W7 | Nicht-escapter Text aus `prices.json` (Händlername der Aktion) in der Angebots-Karte. | `app.js:149` | XSS, falls die externe Quelle manipulierte Namen liefert | S | behoben |
| W8 | Kein Offline/PWA, obwohl Local-First. | `index.html` | im Supermarkt ohne Netz keine Liste | M | behoben: Manifest + Service Worker (network-first, Cache als Fallback) |
| W9 | BILLA-Badge: weiße Schrift auf Gelb (Kontrast ≈ 1,9:1). | `styles.css .badge`, Screenshot Plan | schlecht lesbar | S | behoben: dunkle Schrift bei hellen Markenfarben |
| W10 | Keine Tests für UI, CI nur im täglichen Preis-Lauf. | `.github/workflows` | Regressionen fallen erst live auf | S | behoben: `tests/e2e.js` (Playwright) + Workflow `test.yml` bei Push; e2e auch im Preis-Lauf |
| W11 | Bring!-Export schickt die Liste an httpbin.org (Dritter), ohne dass das irgendwo steht. | `app.js:279` | Datenschutz-Transparenz | S | behoben: Hinweis unter der Liste. Eigener Endpoint bleibt offen (neuer Dienst = Rückfrage) |
| W12 | Pages läuft vom Feature-Branch. | Masterprompt | Live-Stand hängt an einem Arbeitsbranch | S | offen: braucht Merge nach `main` + Umstellen in den Repo-Einstellungen (nur durch Repo-Owner) |

### Nice-to-have

| # | Befund | Beleg | Auswirkung | Aufwand | Status |
|---|---|---|---|---|---|
| N1 | Woche startet heute statt Montag. | `planner.js` `slotsFor` | Gewohnheitssache | S | bewusst nicht: rollierende 7 Tage ab heute passen zum Einkauf „heute“; mit K2 rollt der Plan jetzt automatisch weiter |
| N2 | „Neu planen“ setzt Häkchen zurück. | `app.js:371` | bereits Gekauftes muss neu abgehakt werden | S | behoben: Häkchen bleiben, nur bei neuer Woche zurückgesetzt |
| N3 | Fast jedes Gericht trägt „Aktion“, weil billige Basiszutaten (Karotten, Zwiebeln) in Aktion sind. | Screenshot Plan | Badge verliert Aussagekraft | S | offen |
| N4 | Ähnliche Gerichte am selben Tag (Chili con/sin Carne, 2× Knödel). | Personas Familie/SPAR | weniger Abwechslung | S | behoben: Strafe für gemeinsame Hauptzutaten am selben Tag (gemessen 15 → 0,7 je Woche, Plan sogar günstiger); Test |
| N5 | Single 25 € leicht über Budget, obwohl günstigere Kombinationen existieren. | Persona Single | „0,54 € über Budget“ | M | offen (60 Zufallsläufe; „Automatisch ausgleichen“ löst es) |
| N6 | Nährwerte/Mengen geschätzt; 8 Rezepte ohne Foto, einige Fotos nur ungefähr (z. B. Krautfleckerl = „Pasta Salad“). | `data.js`, `img/credits.json` | Vertrauen | L | teilweise: 293 von 317 Rezepten haben ein frei lizenziertes Foto (`scripts/photos.js`, Openverse; Test prüft Datei, Nachweis und Doppelte). 24 ohne passendes Foto behalten den Emoji-Platzhalter; manche Fotos zeigen das Gericht nur sinngemäß. Nährwerte werden automatisch auf Plausibilität geprüft (`scripts/check-recipes.js`) |
| N7 | HOFER/LIDL/PENNY/MPREIS/ADEG Regalpreise nur über Faktor geschätzt; SPAR-Regalpreise Stand 09/2026; Aktionen nur PLZ 1010; Gang-Reihenfolgen erfunden. | `scripts/prices.js:8`, `data.js STORES` | Preise weichen ab | L | offen (Datenquellen fehlen) |
| N8 | Kein Dark Mode, Desktop nur 480-px-Spalte. | `styles.css` | Optik am Desktop | M | bewusst nicht: mobile Nutzung im Fokus |
| N9 | Kein Teilen zwischen Geräten. | – | – | L | bewusst nicht: bräuchte Konto/Server (Rückfrage); Export/Import (W4) als Brücke |
| N10 | „Automatisch ausgleichen“ verwirft manuelle Tausche. | `app.js:427` (`keepIdx -1`) | Überraschung | S | offen |
| N11 | Rechtliches: marktguru-API inoffiziell (Schlüssel aus der Website), heisse-preise.io ohne Vertrag. | `scripts/offers.js` | Quelle kann jederzeit wegfallen/untersagt werden | – | offen (App fällt sauber auf Schätzungen zurück) |

## Weitere geprüfte Punkte (ohne Handlungsbedarf)
- XSS über eigene Rezepte, Notizen, eigene Artikel: überall `esc()`.
- Fehlende `prices.json`/Openverse-Bilder: Schätzpreise bzw. Emoji-Platzhalter greifen.
- Performance: 14 Slots ≈ 35 ms in Node (Faktor 5–10 auf schwachem Handy noch < 0,5 s); Bilder 50 × ≤ 120 kB, `loading="lazy"`.
- `prefers-reduced-motion` und `:focus-visible` vorhanden; Touch-Ziele ≥ 40 px.

## Nachtrag: Rezeptsammlung 58 → 317

- 259 neue Rezepte in fünf Themenblöcken (Österreich & Mehlspeisen, Italien & Mittelmeer, Asien & Indien, Orient/Mexiko/Balkan/Diner, gesund & Geräte-Rezepte), 60 neue Zutaten mit Preisregeln für BILLA/SPAR.
- Kleine Pools wachsen stark: vegan + streng glutenfrei 5 → 33 Rezepte, nur Mikrowelle 3 → 20.
- `scripts/check-recipes.js` (läuft in `test.js`): Zutaten vorhanden, Mengen plausibel, kcal passt zu den Makros (±20 %), gültige Kategorien/Tags/Geräte, keine Doppelten.
- Performance: Planer prüft bei großem Pool je Slot ein wechselndes Zufallsfenster von 60 Kandidaten (14 Slots ≈ 40 ms in Node); Tausch-Sheet und Entdecken zeigen 40 Einträge mit „Mehr anzeigen“. Gemessen bei 6-fach gedrosselter CPU: Tausch-Sheet 0,4 s, Entdecken 0,2 s.
- Neue Allergene: Senf; Honig schließt vegan aus.
