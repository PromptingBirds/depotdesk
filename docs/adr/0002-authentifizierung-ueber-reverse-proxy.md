# ADR-0002: Authentifizierung über Reverse Proxy

- **Status:** angenommen
- **Datum:** 2026-06-03

## Kontext

Im Betrieb steht DepotDesk hinter dem zentralen Reverse Proxy mit Single Sign-on. Der Proxy authentifiziert die Nutzer und reicht die Kennung weiter. Eine eigene Anmeldung in DepotDesk ist nicht gewünscht.

## Entscheidung

- DepotDesk liest die Benutzerkennung aus einem Header (Standard `X-DepotDesk-User`, konfigurierbar über `AUTH_HEADER`).
- Rollen und Werkszuordnung kommen aus den DepotDesk-Stammdaten, nicht aus dem Token.
- Lokal setzt die Oberfläche den Header über den Demo-Nutzer-Umschalter.
- Die Anwendung darf nur hinter dem Proxy erreichbar sein, der den Header von außen entfernt und neu setzt.

## Konsequenzen

- Keine Passwörter oder Secrets in DepotDesk.
- Jeder Request an `/api` muss den Header tragen. Reine Browser-Navigation (z. B. ein Link, der direkt eine API-URL öffnet) schickt ihn lokal nicht mit, nur `fetch` aus der Oberfläche.
- Tests setzen den Header direkt (siehe `test/helpers.ts`).
