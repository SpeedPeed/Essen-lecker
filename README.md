# Piatto – Wochen-Essensplaner für Österreich

Plant 7 Tage Mittag- und/oder Abendessen passend zu Budget, Haushalt, Ernährung und Küche und rechnet mit
ganzen Supermarkt-Packungen. Die Einkaufsliste ist nach den Gängen des gewählten Markts sortiert. Alles läuft lokal im Browser:
kein Konto, kein Server, kein Build.

## Funktionen

- **Wochenplan** mit 317 Rezepten (alle mit frei lizenziertem Foto): Budget-Ring, Wochen-Nährwerte, „Heute“ hervorgehoben,
  Tauschen mit Suche, Aussetzen („Ich koche selbst“ / „Frei“), feste Kochpause-Tage, selbst gewählte Gerichte bleiben fixiert (📌),
  „Automatisch ausgleichen“ bei Budgetüberschreitung, Rückgängig, „Neue Woche“
- **Reste**: optional „Mittag = Reste vom Vorabend“ (abends doppelt kochen)
- **Echte Preise & Aktionen** für BILLA und SPAR (Regalpreise via heisse-preise.io), Flugblatt-Aktionen für weitere Märkte
  (marktguru); sonst Schätzung über den Preisfaktor des Markts. Täglich aktualisiert per GitHub Action.
- **Einkaufsliste** nach Gang, mit Produkt, Packungsgröße, Aktion, „für welches Gericht“; Kopieren, Teilen, Bring!, Drucken
- **Rezepte**: Portionen anpassen, Kochmodus mit Timern, Zutaten-Einblendung, Wischen, Bildschirm bleibt an
- **Entdecken**: Suche (versteht auch „Kartoffel“, „Tomate“, „knoedel“ …), Kategorien, bis 30 Min., Sortierung,
  Favoriten (kommen im Plan öfter dran), „Nicht mehr vorschlagen“, eigene Rezepte
- **Profil**: Markt, Haushalt (Kinder zählen anteilig), Ernährung, Abneigungen, Allergien (vermeiden oder streng), Küchengeräte;
  Sicherung als Datei exportieren und importieren
- Installierbar (PWA, offline nutzbar), Dark Mode, Desktop-Raster, Zurück-Geste, barrierearm (axe-core ohne Verstöße)

## Starten

Beliebigen statischen Webserver im Repo-Ordner starten, z. B. `python3 -m http.server`, und `http://localhost:8000` öffnen.
(Über `file://` funktioniert die App auch, dann aber ohne echte Preise und Fotonachweise.)

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Seite und Gestaltung |
| `data.js` | Zutaten (Packung, Preis, Gang, Allergene), Märkte, Rezepte |
| `planner.js` | Planungslogik ohne DOM: Eignung, Packungskosten, Planer, Ausgleich, Suche – läuft auch in Node |
| `app.js` | Oberfläche (String-Templates, Klicks über `data-a`), Zustand in `localStorage` (`piatto.v1`) |
| `prices.json` | Echte Preise & Aktionen, erzeugt von `scripts/prices.js` und `scripts/offers.js` |
| `img/` | Rezeptfotos (800×600) und `credits.json` mit Lizenznachweisen |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation |

## Tests

```sh
node test.js                 # Planungslogik, Preise, Rezeptdaten, Fotonachweise
npm i --no-save playwright@1.49.1 axe-core@4.10.2 && npx playwright install chromium
node tests/e2e.js [ordner]   # Klicktest mobil + Desktop inkl. Barrierefreiheit, optional mit Screenshots
```

Beide laufen bei jedem Push in GitHub Actions (`.github/workflows/test.yml`).

## Werkzeuge

- `node scripts/prices.js` / `node scripts/offers.js` – Preise und Aktionen aktualisieren
- `node scripts/check-recipes.js [datei]` – Rezeptdaten prüfen (Zutaten, Nährwerte, Felder)
- `node scripts/photos.js …` – Rezeptfotos von Openverse/Wikimedia Commons suchen, auswählen, zuschneiden, Nachweis eintragen

## Hinweise

Preise ohne Gewähr. Die Preisquellen sind inoffiziell und können jederzeit wegfallen; die App fällt dann auf Schätzungen zurück.
Fotos stehen unter den in `img/credits.json` genannten freien Lizenzen (CC0, CC BY, CC BY-SA, Public Domain).
Reviews und Verbesserungspläne: `docs/REVIEW.md`, `docs/VERBESSERUNGEN.md`.
