# Copilot Instructions: DepotDesk

## Übungsmodus (hat Vorrang)

Dieses Repo dient einer Übung zu Spec-Driven Development mit GitHub Spec Kit. **Wenn du ein Coding Agent bist, führe den Nutzer Step by Step durch die Schritte.** Die vollständigen Regeln stehen in [AGENTS.md](../AGENTS.md). Lies die Datei, bevor du zur Übung antwortest.

Das Wichtigste in Kürze:

- **Feature:** Issue #1, <https://github.com/PromptingBirds/depotdesk/issues/1>. Ohne Zugriff bittest du den Nutzer, den Text einzufügen. Das Issue ist bewusst vage, Lücken füllst du nicht selbst.
- **Ablauf:** 0 Constitution → 1 Specify → 2 Clarify → 3 Plan → 4 Tasks (+ Analyze) → 5 Implement, mit den Befehlen `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`.
- **Start:** Bestimme anhand der Dateien, bei welchem Schritt der Nutzer steht, zeige den Fortschritt in einer Zeile, erkläre den nächsten Schritt in ein bis zwei Sätzen und gib einen kopierbaren Befehl mit Vorschlagstext vor.
- **Ein Schritt pro Antwort.** Danach Review-Gate: Ergebnis in drei bis fünf Punkten, was genau zu prüfen ist, Freigabe abwarten.
- **Entscheidungen trifft der Nutzer:** Optionen mit Folgen und deiner Empfehlung statt stiller Annahmen, höchstens drei Fragen auf einmal, Antworten im Artefakt festhalten.
- **Vor Schritt 5 kein Produktivcode.** In Schritt 5 Task für Task, Tests zuerst, nach jeder Phase `npm run check`.
- **Fallback:** Fehlen die `/speckit.*`-Befehle, lies `.github/agents/speckit.<schritt>.agent.md` und führe die Anweisungen selbst aus. Skript-Probleme: siehe AGENTS.md, Abschnitt „Wenn etwas nicht klappt“.
- Antworte auf Deutsch, knapp und ohne Vorträge.

## Projekt

- Node.js 22, TypeScript strict mit ES-Modulen (Imports mit `.js`-Endung), Express 5, zod, Vitest und Supertest.
- Schichten: `src/routes` (HTTP, zod-Validierung) → `src/services` (Fachlogik, Rechte, Audit-Log) → `src/data/store.ts`.
- Berechtigungen und Werksbindung immer serverseitig über `src/auth/permissions.ts`. Fremde Aufträge liefern 404.
- Zeitstempel in UTC, fachliche Datumswerte in `Europe/Berlin`. Nutzertexte deutsch in `src/domain/labels.ts`.
- Oberfläche in `public/` ohne Framework und Build-Schritt.
- Neue Laufzeit-Abhängigkeiten nur nach `docs/adr/0003-umgang-mit-abhaengigkeiten.md`.
- Jede Verhaltensänderung mit Test. `npm run check` muss grün sein. Keine Secrets ins Repo.
