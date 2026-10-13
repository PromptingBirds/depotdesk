# ADR-0003: Umgang mit Abhängigkeiten

- **Status:** angenommen
- **Datum:** 2026-06-20

## Kontext

Jede Laufzeit-Abhängigkeit muss durch die Freigabe der IT-Sicherheit (Lizenz, Herkunft, Pflege). Das dauert erfahrungsgemäß ein bis zwei Wochen.

## Entscheidung

- Laufzeit-Abhängigkeiten (`dependencies`) werden nur aufgenommen, wenn der Nutzen den Aufwand klar übersteigt. Die Abwägung steht im Pull Request.
- Bevorzugt werden Bordmittel von Node.js und der Browser-Plattform.
- Entwicklungs-Abhängigkeiten (`devDependencies`) sind unkritisch, solange sie nicht im Produktivbetrieb laufen.
- Die Oberfläche bleibt ohne Framework und ohne Build-Schritt.

## Konsequenzen

- Aktuell nur zwei Laufzeit-Abhängigkeiten: `express` und `zod`.
- Wer eine neue Abhängigkeit vorschlägt, nennt Alternativen ohne Abhängigkeit.
