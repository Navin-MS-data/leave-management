export const ROLES = ['employee', 'manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Statuses that occupy balance and team capacity. */
export const ACTIVE_STATUSES: RequestStatus[] = ['pending', 'approved'];

/** The authenticated user attached to each request by the JWT strategy. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  managerId: number | null;
}
