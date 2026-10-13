# ADR-0001: In-Memory-Datenhaltung in der Pilotphase

- **Status:** angenommen
- **Datum:** 2026-05-12

## Kontext

DepotDesk startet als Pilot in vier Werken. Die Anbindung an das ERP-System (Stammdaten Fahrzeuge, Materialwirtschaft) ist noch nicht freigegeben. Für Abstimmungen mit den Werken brauchen wir trotzdem eine lauffähige Anwendung mit realistischen Datenmengen.

## Entscheidung

- Daten liegen im Speicher (`src/data/store.ts`) und werden beim Start deterministisch aus `src/data/seed.ts` erzeugt.
- Alle Zugriffe laufen über die Klasse `Store`. Services greifen nie direkt auf Collections zu.
- Mengengerüst wie im größten Werk: rund 4.000 Aufträge pro Jahr in München, insgesamt etwa 16.000 Aufträge.

## Konsequenzen

- Kein Datenbank-Setup für Entwicklung und Tests nötig.
- Änderungen gehen beim Neustart verloren. Das ist für den Pilot akzeptiert.
- Der spätere Wechsel auf eine Datenbank betrifft nur `src/data/`. Neue Funktionen sollen keine Annahmen treffen, die nur im Speicher funktionieren (z. B. beliebig große Ergebnismengen ohne Grenzen).
