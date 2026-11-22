# Piatto – Verbesserungsplan (Runde 2)

Ausgangslage: Review (`docs/REVIEW.md`) umgesetzt, 317 Rezepte, alle mit Foto. Durchgeklickt auf 390 px und Desktop.
Der größte Hebel liegt jetzt bei der Bedienung: Mit 317 Rezepten muss man gezielt finden und einplanen können,
und der Plan soll zeigen, was heute ansteht.

Leitlinien: kein Framework, kein Build, alles lokal; jede Logikänderung mit Test in `test.js`, Klickpfade in `tests/e2e.js`.

| # | Block | Verbesserung | Warum | Status |
|---|---|---|---|---|
| 1 | Planer | Knapp über Budget → einzelne Gerichte gezielt gegen günstigere tauschen (Review N5) | Single 25 € lag 0,54 € drüber | ✅ umgesetzt |
| 2 | Planer | Selbst gewählte Gerichte werden fixiert (📌): „Neu planen“ und „Automatisch ausgleichen“ behalten sie (Review N10) | Manuelle Tausche gingen verloren | ✅ umgesetzt |
| 3 | Planer | „Aktion“ nur bei spürbarer Ersparnis fürs Gericht, Bevorzugung nach Euro statt Anzahl (Review N3) | Badge klebte an fast jedem Gericht | ✅ umgesetzt |
| 4 | Finden | Rezept direkt einplanen: „Einplanen“ im Rezept → Tag/Mahlzeit wählen | Bisher nur über das Tausch-Fenster | ✅ umgesetzt |
| 5 | Finden | Suche im Tausch-Fenster | 317 Gerichte ohne Suche durchscrollen | ✅ umgesetzt |
| 6 | Finden | Entdecken: Kategorien, „schnell“, Sortierung (Preis, Zeit, kcal) | Nur 4 grobe Filter | ✅ umgesetzt |
| 7 | Plan | „Heute“ hervorheben, vergangene Tage einklappen | Plan läuft 7 Tage, Vergangenes nimmt Platz | ✅ umgesetzt |
| 8 | Plan | Wochen-Nährwerte (Ø kcal & Eiweiß pro Portion) | Überblick über die Woche | ✅ umgesetzt |
| 9 | Rezept | Portionen im Rezept anpassen (Gäste, Vorkochen) | Mengen fix auf Haushalt | ✅ umgesetzt |
| 10 | Rezept | Vorratszutaten getrennt („Aus dem Vorrat“) | Liste voller „nach Geschmack“ | ✅ umgesetzt |
| 11 | Kochen | Zutaten im Kochmodus einblendbar, Wischen/Pfeiltasten für Schritte | Zurück zum Rezept nötig | ✅ umgesetzt |
| 12 | Liste | Erledigte ans Ende, „für: Lasagne, …“ je Artikel | Übersicht beim Einkaufen, Entscheidung was weglassen | ✅ umgesetzt |
| 13 | Optik | Dark Mode | Abends in der Küche, Systemeinstellung | ✅ umgesetzt |
| 14 | Optik | Desktop: breitere Ansicht mit Raster | Am Laptop nur 480-px-Spalte | ✅ umgesetzt |
| 15 | A11y | Karten als echte Buttons statt `display: contents` | Safari hat solche Buttons lange aus dem Accessibility-Baum entfernt | ✅ umgesetzt |
| 16 | Offline | Fotos cache-first im Service Worker | Schnellere Bilder, offline verfügbar | ✅ umgesetzt |

## Runde 3

| # | Block | Verbesserung | Warum | Status |
|---|---|---|---|---|
| 17 | Planer | Favoriten (♥) kommen öfter dran, „Nicht mehr vorschlagen“ schließt ein Gericht aus | ♥ hatte keine Wirkung auf den Plan | ✅ umgesetzt |
| 18 | Bedienung | „Rückgängig“ nach Neu planen, Ausgleichen und Aussetzen | Ein Tipp verwirft sonst die ganze Woche | ✅ umgesetzt |
| 19 | Liste | Vorratsartikel („Vorrat prüfen“) als eigener Abschnitt am Ende | Stören beim Einkauf zwischen den echten Artikeln | ✅ umgesetzt |
| 20 | PWA | PNG-Icons (180/192/512) für Installation auf iOS/Android | iOS ignoriert SVG als Home-Icon | ✅ umgesetzt |
| 21 | A11y | Automatische Prüfung mit axe-core über alle Ansichten, Funde beheben | Kontraste, Namen, Rollen systematisch prüfen | ✅ umgesetzt: 0 Verstöße hell & dunkel (vorher 7 Regeln: Kontrast Markenlogos/Bring!/Grautext, Formular-Labels, Überschriften-Hierarchie, Fortschrittsbalken, Kochmodus-Scrollbereich); axe läuft jetzt im e2e-Test und in der CI mit |

## Runde 4

| # | Block | Verbesserung | Warum | Status |
|---|---|---|---|---|
| 22 | Finden | Suche versteht Umlaute und bundesdeutsche Begriffe (Kartoffel → Erdäpfel, Tomate → Paradeiser, Hackfleisch → Faschiertes, knoedel → Knödel), mehrere Wörter = alle müssen passen | Wer „Kartoffel“ tippt, fand kein Erdäpfelgulasch | ✅ umgesetzt |
| 23 | Planer | Option „Mittag = Reste vom Vorabend“: Abendessen doppelt, Mittag aufwärmen; Plan bevorzugt dafür aufwärmbare Gerichte | Weniger kochen, im Test Ø 44 € statt 62 € pro Woche | ✅ umgesetzt |
| 24 | Onboarding | „Rest überspringen – Plan jetzt erstellen“ ab Schritt 5 | 9 Schritte bis zum ersten Plan | ✅ umgesetzt |
| 25 | Plan | Wochenplan teilen (Text) und Druckansicht für Plan und Einkaufsliste | Familie informieren, Liste am Kühlschrank | ✅ umgesetzt |
| 26 | Tempo | Packungen je Markt gemerkt, Rezept-Index für Wochenpreise, Suche wartet kurz aufs Tippen | 6× gedrosselte CPU: Tausch-Fenster 519 → 364 ms, Suche 778 → 231 ms, Neu planen 588 → 447 ms | ✅ umgesetzt |
| 27 | Bedienung | Zurück-Geste/-Taste: schließt Fenster, verlässt Kochmodus und Rezept; Direktlinks `#list`, `#discover`, App-Verknüpfungen | Android-Zurück schloss bisher die ganze App | ✅ umgesetzt |
