# Datenschutz

## Personenbezogene Daten in DepotDesk

| Daten | Wo | Zweck |
|---|---|---|
| Name, E-Mail, Rolle, Heimatwerk der Nutzer | `User` | Anmeldung, Anzeige, Rechte |
| Zuweisung Auftrag ↔ Techniker:in | `WorkOrder.assigneeId` | Arbeitsplanung |
| Ersteller eines Auftrags | `WorkOrder.createdBy` | Nachvollziehbarkeit |
| Arbeitszeit pro Auftrag | `WorkOrder.laborHours` | Kalkulation |
| Wer hat wann was geändert | Audit-Log | Nachvollziehbarkeit, Revision |

## Grundsätze

- **Zweckbindung:** Die Daten dienen der Planung und Nachverfolgung von Instandhaltung. Auswertungen, die Rückschlüsse auf Leistung oder Verhalten einzelner Beschäftigter zulassen, sind mit dem Betriebsrat abzustimmen, bevor sie gebaut werden.
- **Datensparsamkeit:** Neue Funktionen zeigen oder übertragen personenbezogene Daten nur, wenn sie für den Zweck nötig sind.
- **Sichtbereich:** Die Werksbindung der Rollen gilt für alle Wege, auf denen Daten DepotDesk verlassen oder angezeigt werden.
- **Nachvollziehbarkeit:** Schreibende Aktionen landen im Audit-Log.

Ansprechpartner bei Fragen: Datenschutzkoordination Instandhaltung (intern).
