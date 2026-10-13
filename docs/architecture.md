# Architektur

DepotDesk ist eine einzelne Node.js-Anwendung: Ein Express-Server liefert die JSON-API unter `/api` und die statische Oberfläche aus `public/`.

```
Browser (public/app.js)
   │  fetch + Header X-DepotDesk-User
   ▼
Express ─ src/app.ts
   ├─ auth/authenticate.ts      Benutzer aus Header lesen, 401 bei Unbekannten
   ├─ routes/*.ts               HTTP, Eingaben mit zod validieren
   ├─ services/*.ts             Fachlogik: Sichtbarkeit, Rechte, Statuswechsel, Audit-Log
   └─ data/store.ts             In-Memory-Datenhaltung, befüllt aus data/seed.ts
```

## Schichten

| Schicht | Verantwortung | Darf nicht |
|---|---|---|
| `routes/` | Request lesen, mit zod validieren, Service aufrufen, Statuscode setzen | Fachregeln enthalten |
| `services/` | Filtern, Sortieren, Berechtigungen und Werksbindung prüfen, Audit-Einträge schreiben | Express-Objekte kennen |
| `domain/` | Typen, Status-Lebenszyklus, Anzeigetexte | Seiteneffekte haben |
| `data/` | Speichern und Laden, Demo-Daten erzeugen | Berechtigungen prüfen |

Services bekommen einen `AppContext` (`store`, `now`, `authHeader`). `now` ist injizierbar, damit Tests mit einem festen Stichtag laufen.

## API

| Methode | Pfad | Zweck | Recht |
|---|---|---|---|
| GET | `/api/health` | Health-Check | öffentlich |
| GET | `/api/demo-users` | Demo-Nutzer für den Umschalter | öffentlich |
| GET | `/api/me` | Aktueller Nutzer mit Rechten | angemeldet |
| GET | `/api/meta` | Status, Typen, Prioritäten mit Anzeigetexten | angemeldet |
| GET | `/api/depots`, `/api/vehicles` | Stammdaten im Sichtbereich | angemeldet |
| GET | `/api/technicians` | Techniker:innen für die Zuweisung | `work_orders:assign` |
| GET | `/api/stats` | Kennzahlen für die Kopfzeile | angemeldet |
| GET | `/api/work-orders` | Liste mit Filtern, Sortierung, Seiten | `work_orders:read` |
| GET | `/api/work-orders/:id` | Details inkl. Ersatzteile | `work_orders:read` |
| POST | `/api/work-orders` | Auftrag anlegen | `work_orders:create` |
| POST | `/api/work-orders/:id/status` | Status ändern | `work_orders:update_status` |
| POST | `/api/work-orders/:id/assign` | Zuweisen | `work_orders:assign` |
| GET | `/api/audit` | Letzte Audit-Einträge | `audit:read` |

Listen-Parameter für `/api/work-orders`: `q`, `status` (kommagetrennt), `type`, `priority`, `depot`, `assignee` (`me` oder Kennung), `dueFrom`, `dueTo`, `overdue`, `sort` (`dueDate`, `createdAt`, `priority`, `id`), `order`, `page`, `pageSize` (max. 100).

Fehler kommen immer im Format `{ "error": { "code", "message", "details?" } }`. Aufträge fremder Werke liefern 404, nicht 403, damit ihre Existenz nicht sichtbar wird.

## Oberfläche

`public/` enthält HTML, CSS und ein ES-Modul ohne Framework und ohne Build-Schritt. Filter, Sortierung, Seite und geöffneter Auftrag stehen in der URL, damit Ansichten teilbar sind. Der Demo-Nutzer wird im `localStorage` gemerkt und bei jedem API-Aufruf als Header mitgeschickt.

## Zeit und Datum

- Zeitstempel (`createdAt`, `updatedAt`, `plannedStart`, `completedAt`) werden in UTC als ISO 8601 gespeichert und übertragen.
- Fachliche Datumswerte (`dueDate`) sind reine Kalenderdaten in Werkszeit (`Europe/Berlin`).
- Die Oberfläche formatiert für `de-DE` in `Europe/Berlin`.

## Daten

Siehe [ADR-0001](adr/0001-in-memory-datenhaltung.md). Beim Start erzeugt `data/seed.ts` deterministisch etwa 16.000 Aufträge über rund 21 Monate in vier Werken. Änderungen gehen beim Neustart verloren.
