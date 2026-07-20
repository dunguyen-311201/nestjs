import { Role } from '@app/contracts';

export interface RouteAccess {
  method?: string;
  pattern: RegExp;
  roles: Role[];
}

// Permission matrix from docs/10-authz-plan.md. First match wins; admin
// passes everywhere (checked in the guard, not listed per row). Routes
// matching no row are admin-only (fail-closed).
export const ROUTE_ACCESS: RouteAccess[] = [
  { pattern: /^\/orders(\/.*)?$/, roles: ['customer'] },
  { pattern: /^\/payments(\/.*)?$/, roles: ['customer'] },
  { pattern: /^\/tracking(\/.*)?$/, roles: ['customer'] },
  { pattern: /^\/couriers(\/.*)?$/, roles: ['shipper'] },
  { pattern: /^\/hubs(\/.*)?$/, roles: ['hub_staff'] },
  { pattern: /^\/trips(\/.*)?$/, roles: ['dispatcher'] },
  { pattern: /^\/parcels(\/.*)?$/, roles: ['dispatcher'] },
];
