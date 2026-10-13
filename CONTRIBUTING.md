# Beitragen

## Setup

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # Typecheck und Tests, muss vor jedem PR grün sein
```

Node.js 22 oder neuer (siehe `.nvmrc`). Konfiguration über `.env`, Vorlage in `.env.example`. Es gibt keine Secrets.

## Arbeitsweise

- Branches: `feature/<kurzname>`, `fix/<kurzname>` oder bei Spec Kit `NNN-<kurzname>` passend zum Ordner unter `specs/`.
- Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Größere Features starten mit einer Spec unter `specs/` (GitHub Spec Kit). Spec, Plan und Tasks werden mit dem Code zusammen reviewt.
- Architekturentscheidungen als ADR unter `docs/adr/`.

## Code-Konventionen

- TypeScript im Strict-Modus, ES-Module, Imports mit `.js`-Endung.
- Eingaben an der Systemgrenze mit zod validieren (Schemas in den Services).
- Keine Fachlogik in Routen. Routen rufen Services auf, Services greifen über `Store` auf Daten zu.
- Berechtigungen und Werksbindung immer serverseitig prüfen (`src/auth/permissions.ts`). Fremde Aufträge liefern 404.
- Schreibende Aktionen erzeugen einen Audit-Eintrag.
- Zeitstempel in UTC (ISO 8601), fachliche Datumswerte in `Europe/Berlin`.
- API-Felder und Code auf Englisch, Texte für Nutzer auf Deutsch (`src/domain/labels.ts`).
- Fehler über `HttpError` werfen, nie direkt `res.status(...)` in Services.

## Tests

- Vitest und Supertest, Tests unter `test/`.
- Jede Verhaltensänderung bekommt einen Test, API-Änderungen einen API-Test.
- Tests laufen gegen einen festen Stichtag (`test/helpers.ts`), nie gegen das aktuelle Datum.

## Pull Requests

- Klein halten, eine Sache pro PR.
- Beschreibung nach Vorlage, Bezug zum Issue.
- Mindestens ein Review.
