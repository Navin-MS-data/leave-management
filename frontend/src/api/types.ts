export type Role = 'employee' | 'manager' | 'admin';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  managerId: number | null;
}

export interface User extends AuthUser {
  active: boolean;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LeaveType {
  id: number;
  name: string;
  yearlyAllowance: number | null;
  isPaid: boolean;
}

export interface PublicHoliday {
  id: number;
  date: string;
  name: string;
}

export interface Settings {
  minNoticeDays: number;
  maxTeamOffPerDay: number;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  year: number;
  reason: string;
  status: RequestStatus;
  decidedById: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  createdAt: string;
  user?: User;
  leaveType?: LeaveType;
  decidedBy?: User | null;
}

export type ViolationCode =
  | 'INVALID_DATE'
  | 'END_BEFORE_START'
  | 'CROSSES_YEAR'
  | 'NO_WORKING_DAYS'
  | 'MIN_NOTICE'
  | 'INSUFFICIENT_BALANCE'
  | 'OWN_OVERLAP'
  | 'TEAM_COVERAGE';

export interface Violation {
  code: ViolationCode;
  message: string;
  dates?: string[];
}

export interface PreviewResult {
  valid: boolean;
  days: number;
  workingDays: string[];
  violations: Violation[];
  allowance: number | null;
  remainingAfter: number | null;
}

export interface BalanceLine {
  leaveTypeId: number;
  leaveTypeName: string;
  allowance: number | null;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface UserBalance {
  userId: number;
  userName: string;
  year: number;
  balances: BalanceLine[];
}

export interface CalendarEntry {
  id: number;
  userId: number;
  userName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved';
}

export interface CalendarResponse {
  from: string;
  to: string;
  maxTeamOffPerDay: number;
  teamSize: number;
  members: { id: number; name: string; role: Role }[];
  entries: CalendarEntry[];
  holidays: { date: string; name: string }[];
  coverage: Record<string, number>;
}
