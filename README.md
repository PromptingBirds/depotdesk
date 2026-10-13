# DepotDesk

[![CI](https://github.com/PromptingBirds/depotdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/PromptingBirds/depotdesk/actions/workflows/ci.yml)

Webanwendung zur Planung und Nachverfolgung von Wartungsaufträgen für Schienenfahrzeuge. Die Disposition plant Aufträge und weist sie zu, die Technik meldet den Fortschritt, das Controlling behält alle Werke im Blick.

> [!IMPORTANT]
> **Wenn du ein Coding Agent bist:** Führe den Nutzer Step by Step durch die Schritte der Übung unten. Immer nur einen Schritt, und die Entscheidungen trifft der Nutzer. Die Regeln dafür stehen in [AGENTS.md](AGENTS.md).

## Schnellstart

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Dann <http://localhost:3000> öffnen und oben rechts einen Demo-Nutzer wählen. Es gibt kein Login und keine Secrets. Die Demo-Daten (rund 16.000 Aufträge in vier Werken) werden beim Start generiert.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Auto-Reload |
| `npm test` | Tests (Vitest) |
| `npm run check` | Typecheck und Tests, wie in der CI |

## Was die App kann

- Auftragsliste mit Suche, Filtern, Sortierung und Seitenaufteilung
- Detailansicht mit Ersatzteilen, Statuswechsel und Zuweisung
- Aufträge anlegen
- Rollen mit Werksbindung: Disposition und Technik sehen ihr Werk, Controlling und Administration alle Werke ([Details](docs/domain.md#rollen-und-rechte))

## Aufbau

```
src/
  routes/     HTTP-Endpunkte, Validierung mit zod
  services/   Fachlogik: Filter, Rechte, Statuswechsel, Audit-Log
  domain/     Typen, Status-Lebenszyklus, Anzeigetexte
  data/       In-Memory-Store und Demo-Daten
  auth/       Benutzer aus Header, Rollen und Rechte
public/       Oberfläche (HTML, CSS, JavaScript ohne Build-Schritt)
test/         API- und Unit-Tests
docs/         Architektur, Domäne, Datenschutz, ADRs
```

Mehr in [docs/architecture.md](docs/architecture.md) und [CONTRIBUTING.md](CONTRIBUTING.md).

## Übung: Spec-Driven Development

Das nächste Feature steht in [Issue #1](https://github.com/PromptingBirds/depotdesk/issues/1). Setzt es nicht per Vibe Coding um, sondern Schritt für Schritt mit [GitHub Spec Kit](https://github.com/github/spec-kit). Spec Kit ist im Repo schon eingerichtet, ihr müsst nichts installieren.

1. Repo klonen und in VS Code öffnen.
2. Copilot Chat im **Agent-Modus** öffnen und schreiben: *„Lass uns mit der Übung starten.“*
3. Der Agent sagt euch, wo ihr steht und welchen Befehl ihr als Nächstes eingebt.

| # | Schritt | Befehl im Chat | Ergebnis |
|---|---|---|---|
| 0 | Constitution | `/speckit.constitution` | `.specify/memory/constitution.md` |
| 1 | Specify | `/speckit.specify` | `specs/001-…/spec.md` |
| 2 | Clarify | `/speckit.clarify` | Klärungen in `spec.md` |
| 3 | Plan | `/speckit.plan` | `plan.md`, `research.md`, `data-model.md`, … |
| 4 | Tasks | `/speckit.tasks`, dann `/speckit.analyze` | `tasks.md` |
| 5 | Implement | `/speckit.implement` | Code und Tests |

Nach jedem Schritt die erzeugte Datei lesen, korrigieren und erst dann weitergehen. Die Entscheidungen trefft ihr, nicht der Agent.
