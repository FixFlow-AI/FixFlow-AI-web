import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../services/userRepository.js';

/**
 * Role-based authorization middleware. Layer it AFTER `requireAuth`, which sets
 * `req.auth` (with the `role` claim from the access token).
 *
 * Usage:
 *   app.post('/api/dev/projects', requireAuth, requireRole('developer'), handler)
 *   app.get('/api/freelancer/profile', requireAuth, requireRole('freelancer'), handler)
 *
 * Enforces the permission matrix in docs/specifications/roles/00_role_architecture_overview.md.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'forbidden_for_role', allowed: roles, actual: role ?? null });
      return;
    }
    next();
  };
}
