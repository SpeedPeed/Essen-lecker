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
| 28 | Plan | „Neue Woche“, sobald nur noch heute/morgen geplant ist: heutige Gerichte bleiben, neue Einkaufsliste, Rückgängig möglich | Bisher erst nach Ablauf aller Tage automatisch | ✅ umgesetzt |

## Unabhängige Fehlerprüfung der Runden 2–4

Eine zweite, unabhängige Durchsicht des Diffs fand 6 reproduzierbare Fehler und einige Verdachtsfälle – alle behoben:

| Fund | Behebung |
|---|---|
| „Nicht mehr vorschlagen“ → Rückgängig löschte den Favoriten | Rückgängig sichert und stellt auch Favoriten wieder her |
| Fixierter Reste-Mittag verlor beim Neuplanen sein Abendessen | Abendessen wird mit fixiert; `planWeek` hält das Paar zusammen (Test) |
| Neuer Kochpause-Tag ließ fixierte Gerichte an dem Tag stehen | Kochpause hat Vorrang vor Fixiertem (Test) |
| „Rest überspringen“ verdeckte auf 320 px Inhalt | Mehr Abstand unten im Onboarding |
| Drucken im Dark Mode: Summe fast unsichtbar | Druck setzt helle Farb-Token |
| Angebotskarte behielt Kategorie-/Zeitfilter in Entdecken | Filter werden zurückgesetzt |
| Präparierte Sicherungsdatei konnte HTML einschleusen (Rezept-Id, Farbton, Zahlen) | `normalize()` prüft alle Felder streng (Ids, Zahlenbereiche, bekannte Werte) |
| Fotos im Service Worker wurden nie aktualisiert | Cache sofort, im Hintergrund still erneuern |
| Ausgleichen mit Reste-Option schwächer | Nur selbst gewählte Reste-Paare bleiben fest, erzeugte dürfen neu entstehen |
| Unerreichbares Budget: Planung langsam | Sparphase kürzer, bei aussichtslosem Budget nur ein Entwurf nachgebessert (376 → 236 ms) |
| e2e gelegentlich instabil nach Reload | Adresse vor dem Reload zurückgesetzt |

## Runde 5

| # | Block | Verbesserung | Warum | Status |
|---|---|---|---|---|
| 29 | Datenschutz | Schriften selbst gehostet (SIL OFL), keine Anfragen an Google mehr | Google Fonts übertragen die IP-Adresse (in AT/DE rechtlich heikel), „alles lokal“ stimmt jetzt; offline und schneller | ✅ umgesetzt |
| 30 | Sicherheit | Content-Security-Policy: nur eigene Skripte, keine Fremdquellen | Zweite Verteidigungslinie gegen eingeschleustes HTML | ✅ umgesetzt |
| 31 | A11y | Fenster als `aria-modal`: Fokus beim Öffnen hinein, Tab bleibt drin, beim Schließen zurück zum Auslöser | Tastatur/Screenreader landeten hinter dem Fenster | ✅ umgesetzt |
| 32 | Robustheit | Speicher blockiert (privates Fenster): Hinweis nur einmal und verständlich | Toast bei jedem Tippen | ✅ umgesetzt |
| 33 | Optik | Banner kürzer („Echte Preise vom 22.11. · 11 Aktionen“), Mikrowellen-Symbol statt Radio | Vier Zeilen Kleingedrucktes, falsches Symbol | ✅ umgesetzt |

## Runde 6: Persona-Test mit frischen Augen

Ein unabhängiger Agent hat die App als vier Personas durchgespielt: Familie mit SPAR, vegetarischer Single mit 25 €, Seniorin mit großer Schrift und Druckwunsch, vegan + glutenfrei streng. Gefunden hat er 15 Probleme, alle behoben:

| # | Fund | Behebung |
|---|---|---|
| 1 | Erster Plan wurde beim ersten Neuladen still ersetzt | `planVersion` beim ersten Plan gesetzt |
| 2 | Allergien „vermeiden“ als Standard → Gluten im Plan | Standard „streng“; Allergene im Rezept (eigene rot), Warn-Tag auf Plankarten, Gründe im Tauschen, Rückfrage vor unpassendem Gericht |
| 3 | Kochmodus bei 200 % Zoom nicht bedienbar | scrollbar, Knöpfe unten fix |
| 4 | Schrift in px, Überlauf bei Zoom, kleine Knöpfe | rem, kein Überlauf bei 195 px, Knöpfe ≥ 44 px |
| 5 | Neu planen = dieselben Gerichte | bisherige Woche wird gemieden (Test) |
| 6 | Budget-Regler fummelig, Vorschlag oft nicht erreichbar | ±5 €, bei Überschreitung „Budget auf X €“ |
| 7 | Vorlieben prägen den Plan kaum (5× Nudeln, „schnell“ mit 75-Min.-Gerichten, scharf für Kinder) | Nudeln ≈ 2 pro 7 Mahlzeiten, „schnell“ an Werktagen hart, Scharfes für Kleinkinder gemieden (Test) |
| 8 | Profil ändern warf den ganzen Plan um, ohne Rückgängig | nur Nötiges ändern, immer Rückgängig |
| 9 | Tauschen: „Ich koche selbst“ als Hauptknopf, nur nach Preis sortiert | Vorschläge nach Vorlieben + Preis, Aussetzen dezent |
| 10 | „4 am Tisch“ → „3 Portionen“ unerklärt | Erklärung im Haushalt-Schritt und im Plan |
| 11 | Einkaufsliste nicht vernünftig druckbar | Drucken-Knopf, zweispaltiger Druck ohne Beiwerk |
| 12 | Erster Bildschirm erklärt die App nicht | Begrüßung mit 3 Punkten |
| 13 | „€ 0“-Preise, alte SPAR-Preise als „echt“, Zähler 29 vs. 46 | Cent unter 10 €, „evtl. veraltet“, gleicher Zähler |
| 14 | Unpassende Angebote, „1 Rezept passen“ | nur Angebote für passende Rezepte, Einzahl |
| 15 | Risotto mit Langkornreis | neue Zutat Risottoreis inkl. echter BILLA/SPAR-Preise |

Dazu: 14 Rezepte hatten kürzere Gesamtzeiten als ihre Timer, 6 trugen „schnell“ bei über 30 Min. – korrigiert, `check-recipes.js` prüft beides.
