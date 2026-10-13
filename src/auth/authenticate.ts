import type { RequestHandler, Response } from 'express';
import type { AppContext } from '../context.js';
import type { User } from '../domain/types.js';
import { forbidden, HttpError } from '../lib/errors.js';
import { can, type Permission } from './permissions.js';

/**
 * Liest die Benutzerkennung aus einem HTTP-Header.
 * Im Betrieb setzt der vorgelagerte Reverse Proxy den Header nach SSO-Anmeldung,
 * lokal setzt ihn die Oberfläche über den Demo-Nutzer-Umschalter.
 * Siehe docs/adr/0002-authentifizierung-ueber-reverse-proxy.md
 */
export function authenticate(ctx: AppContext): RequestHandler {
  return (req, res, next) => {
    const userId = req.get(ctx.authHeader)?.trim();
    if (!userId) throw new HttpError(401, 'unauthenticated', 'Nicht angemeldet');
    const user = ctx.store.getUser(userId);
    if (!user) throw new HttpError(401, 'unauthenticated', `Unbekannter Benutzer "${userId}"`);
    res.locals.user = user;
    next();
  };
}

export function currentUser(res: Response): User {
  return res.locals.user as User;
}

export function requirePermission(permission: Permission): RequestHandler {
  return (_req, res, next) => {
    if (!can(currentUser(res), permission)) throw forbidden();
    next();
  };
}
