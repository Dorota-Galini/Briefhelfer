# Briefhelfer

Briefe von Behörden, Versicherungen und Krankenkassen verstehen und Formulare ausfüllen, in einfachem Deutsch.
Persönliche Angaben werden im Browser geschwärzt, bevor irgendetwas an eine KI geht. Die echten Namen setzt
der Browser in der Antwort wieder ein.

Ein Projekt von [Galini Studio](https://galini-studio.de).

## Zwei Betriebsarten

| | Demo | Selbst betreiben |
|---|---|---|
| Einstellung | `PUBLIC_BRIEFHELFER_MODUS=demo` (`.env.demo`) | `voll`, der Standard |
| Dokumente | fünf erfundene Beispiele | eigene PDFs, Fotos, Scans |
| KI | keine Aufrufe, Antworten vorab erzeugt | Claude API mit eigenem Schlüssel |
| Server | keiner nötig, rein statisch | nötig für `/api/*` |
| Feedback | über Netlify Forms an Galini Studio | nicht eingebaut |

Die öffentliche Demo verarbeitet keine echten Briefe. Wer den Briefhelfer mit eigenen Briefen betreibt,
ist für diese Installation selbst verantwortlich: Impressum, Datenschutzerklärung, Einwilligungen,
Verträge mit Hoster und KI-Anbieter. Briefe können Gesundheits- und Sozialdaten enthalten (Art. 9 DSGVO).

## So funktioniert der Datenschutz

1. Der Brief wird im Browser gelesen: pdf.js für PDFs, Tesseract.js für Fotos und Scans. Auch Tesseract
   (Worker, Kern, deutsches Sprachpaket) kommt vom eigenen Server, nicht von einem CDN.
2. Persönliche Angaben werden im Browser erkannt (Regeln und eine Vornamen-Liste, kein Modell) und durch
   Platzhalter wie `[PERSON_1]` ersetzt. Fristen, Beträge, Behördennamen und Paragrafen bleiben stehen.
3. Die Person sieht unter „Das sieht die KI“ genau den Text, der gesendet würde, und kann nachschwärzen.
4. Nur dieser Text geht über die eigene Server-Route an Claude. Der API-Schlüssel liegt nur auf dem Server
   und wird zur Laufzeit gelesen, nie beim Bauen in den Code geschrieben.
5. Jede Aussage der KI kommt mit wörtlichem Zitat. Der Browser prüft lokal, ob es im gesendeten Text steht.
6. Formulareingaben verlassen das Gerät nie. Das ausgefüllte PDF entsteht im Browser.

Die Erkennung kann Angaben übersehen, und auch der übrige Inhalt kann Rückschlüsse auf Personen erlauben.
Deshalb ist die Sichtkontrolle durch die Person ein fester Schritt.

## Selbst betreiben

```bash
npm install
cp .env.example .env      # ANTHROPIC_API_KEY eintragen
npm run dev               # http://localhost:4321
```

In der Anthropic Console ein **monatliches Ausgabenlimit** setzen. Das Tageslimit im Server
(5 Anfragen pro Adresse, im Arbeitsspeicher) ist nur ein zusätzlicher Schutz und bei mehreren
Server-Instanzen nicht belastbar.

Zum Hosten `npm run build` und `node dist/server/entry.mjs` mit gesetzter Umgebungsvariable
`ANTHROPIC_API_KEY`. Für andere Hoster den Astro-Adapter in `astro.config.mjs` tauschen.
Die eigenen Angaben für Impressum und Datenschutz gehören in `src/config.ts`.

## Demo

```bash
npm run dev:demo          # Demo lokal ansehen
npm run build:demo        # statische Seite in dist/client, z. B. für Netlify
```

Die Beispieldokumente erzeugt `node scripts/beispiele-erzeugen.mjs` (PDFs) und
`scripts/scan-vorlage.html` (Scan, mit Edge headless fotografiert). Die vorab erzeugten KI-Antworten
liegen in `src/beispiele/antworten/`. Neu erzeugen: `npm run dev`, dann `/werkstatt` öffnen
(nur in der Entwicklung, kostet pro Beispiel ein paar Cent), danach den Server neu starten.

## Tests

```bash
npm test                  # ohne echten Schlüssel, die API ist nachgebildet
npm run pruefsatz         # gegen die echte API, kostet Geld (erfundene Problemfälle)
```

Der Prüfsatz deckt ab: Verneinung, zwei Personen, mehrere Fristen, OCR-Zahlendreher, relative Frist,
Anweisungen an die KI im Brieftext. `test/demo-antworten.test.ts` prüft, dass jeder Beleg der Demo
wörtlich im gesendeten Text steht und kein erfundener Name ungeschwärzt bei der KI angekommen ist.

Echte Briefe zum Testen in `testbriefe/` legen. Der Ordner wird nicht eingecheckt.

## Bekannte Grenzen

- Namen, die nicht in der Vornamen-Liste stehen und ohne Anrede vorkommen, werden nicht erkannt.
- Bei Scans wird pro Zeile nur das erste Kästchen als ☒ / ☐ markiert, weitere erscheinen als Zeichenmüll.
- Gescannte Papierformulare werden erklärt, aber nicht ausgefüllt. Ausfüllen geht nur bei PDFs mit Eingabefeldern.

## Lizenz

Copyright © 2026 Dorota Mikolajczyk, [Galini Studio](https://galini-studio.de)

Der Briefhelfer steht unter der **GNU Affero General Public License v3.0 oder später** (siehe [LICENSE](LICENSE)).
Sie dürfen ihn nutzen, verändern und weitergeben. Wer eine veränderte Fassung als Dienst im Netz anbietet,
muss den Quellcode dieser Fassung ebenfalls unter der AGPL zugänglich machen.

## Hinweis

Der Briefhelfer erklärt Briefe. Er ersetzt keine Rechts-, Steuer- oder Sozialberatung.
