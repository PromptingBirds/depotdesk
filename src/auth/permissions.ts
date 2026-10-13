import type { Role, User } from '../domain/types.js';

export type Permission =
  | 'work_orders:read'
  | 'work_orders:create'
  | 'work_orders:update_status'
  | 'work_orders:assign'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['work_orders:read'],
  technician: ['work_orders:read', 'work_orders:update_status'],
  dispatcher: ['work_orders:read', 'work_orders:create', 'work_orders:update_status', 'work_orders:assign'],
  admin: ['work_orders:read', 'work_orders:create', 'work_orders:update_status', 'work_orders:assign', 'audit:read'],
};

export function permissionsOf(user: User): readonly Permission[] {
  return ROLE_PERMISSIONS[user.role];
}

export function can(user: User, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * Welche Werke darf ein Nutzer sehen?
 * Technik und Disposition sind an ihr Heimatwerk gebunden, Controlling und Administration sehen alle Werke.
 */
export function depotScope(user: User): 'all' | string[] {
  if (user.role === 'viewer' || user.role === 'admin') return 'all';
  return user.depot ? [user.depot] : [];
}

export function canSeeDepot(user: User, depot: string): boolean {
  const scope = depotScope(user);
  return scope === 'all' || scope.includes(depot);
}
