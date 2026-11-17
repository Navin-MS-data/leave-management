# Leave Management API: frontend reference

Everything the React app needs to talk to the backend. Source of truth is the code in `backend/src`.

- **Base URL:** `http://localhost:3000` (env `PORT`)
- **CORS:** allowed origin is `CORS_ORIGIN` (default `http://localhost:5173`, the Vite dev server)
- **Format:** JSON in, JSON out
- **Start the API:** `npm run start:dev` in `backend` (needs `backend/.env`; see `.env.example`)
- **Reset demo data:** `npm run seed` (wipes the database, then log in again because old tokens stop working)

---

## 1. Conventions

### Dates
- Dates are plain strings `"YYYY-MM-DD"` with no time zone, for example `"2027-02-01"`.
- **Do not** parse them with `new Date("2027-02-01")` for display. That is UTC and can show the previous day in some time zones. Split the string, or use a date-only helper.
- Strings in ISO format compare correctly with `<` and `>`.
- Timestamps (`createdAt`, `decidedAt`, `cancelledAt`) are full ISO date-times.

### Authentication
1. `POST /auth/login` returns `accessToken`.
2. Send `Authorization: Bearer <accessToken>` on **every** other call. Without it you get `401 {"message":"Unauthorized"}`.
3. Tokens last 8 hours. On any `401`, clear the token and go to the login page.
4. The server reloads the user on each call, so a role change or deactivation applies immediately. After one, call `GET /auth/me` again.

### Roles
| Role | Can do |
|---|---|
| `employee` | Request leave, cancel own requests, see own balance, see own team calendar |
| `manager` | Everything an employee can, plus decide on **their own reports'** requests, see reports' balances |
| `admin` | Manage configuration (users, leave types, holidays, settings), decide on **managers'** requests, see all balances and the whole calendar. **Admins cannot request leave and have no balance.** |

The UI should hide what a role cannot do, but the server enforces it (`403`).

### Teams
A team is a manager plus their direct reports. Team coverage and the team calendar use this. A manager's own leave is decided by an admin.

### Errors
| Status | Meaning | Body |
|---|---|---|
| 400 | Invalid input (validation, bad id, bad query) | `{ statusCode, error, message: string[] \| string }` |
| 401 | Missing, invalid or expired token, or inactive user | `{ statusCode: 401, message: "Unauthorized" }` |
| 403 | Role or ownership not allowed | `{ statusCode, message }` |
| 404 | Not found | `{ statusCode, message }` |
| 409 | Conflict (invalid status change, duplicate, in use) | `{ statusCode, message }` |
| 422 | A business rule failed | `{ statusCode: 422, error, message, violations: Violation[] }` |

`message` on a 400 can be an **array** of strings. Show `violations[].message` for a 422. `message` there is just the first one.

---

## 2. TypeScript types

Paste into `frontend/src/types/api.ts`.

```ts
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
  yearlyAllowance: number | null; // null = unlimited
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
  days: number;               // working days only
  year: number;               // calendar year of startDate
  reason: string;
  status: RequestStatus;
  decidedById: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  createdAt: string;
  // Present depending on the endpoint (see section 3)
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
  dates?: string[]; // TEAM_COVERAGE: the days that are over the limit
}

export interface PreviewResult {
  valid: boolean;
  days: number;
  workingDays: string[];
  violations: Violation[];
  allowance: number | null;
  remainingAfter: number | null; // null = unlimited
}

export interface BalanceLine {
  leaveTypeId: number;
  leaveTypeName: string;
  allowance: number | null; // null = unlimited
  used: number;             // approved days
  pending: number;          // pending days (already counted against the balance)
  remaining: number | null; // allowance - used - pending; null = unlimited
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
  coverage: Record<string, number>; // date -> people off; only working days with >= 1 person off
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  violations?: Violation[];
}
```

---

## 3. Endpoints

`Any` means any signed-in user.

### Auth
| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` | `LoginResponse` (200) |
| GET | `/auth/me` | Any | none | `AuthUser` |

### Leave requests
| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| POST | `/leave-requests` | employee, manager | `{ leaveTypeId, startDate, endDate, reason }` (reason required, max 500) | `LeaveRequest` (201), with `user`, `leaveType`, `decidedBy` |
| POST | `/leave-requests/preview` | employee, manager | `{ leaveTypeId, startDate, endDate }` (no reason needed) | `PreviewResult` (201). **Saves nothing.** |
| GET | `/leave-requests/mine` | employee, manager | none | `LeaveRequest[]` with `leaveType`, newest start first |
| GET | `/leave-requests/inbox?status=pending` | manager, admin | none | `LeaveRequest[]` with `user`, `leaveType`, oldest start first |
| GET | `/leave-requests/:id` | owner, owner's manager, admin | none | `LeaveRequest` with `user`, `leaveType`, `decidedBy` |
| PATCH | `/leave-requests/:id/approve` | manager (own reports), admin (managers' requests) | `{ note? }` | `LeaveRequest` |
| PATCH | `/leave-requests/:id/reject` | manager (own reports), admin (managers' requests) | `{ note? }` | `LeaveRequest` |
| PATCH | `/leave-requests/:id/cancel` | owner, owner's manager, admin | none | `LeaveRequest` |

Notes:
- **Inbox:** a manager sees their reports' requests. An admin sees managers' requests. `status` is one of `pending` (default), `approved`, `rejected`, `cancelled` or `all`. Anything else gives 400.
- **Nobody can decide their own request.** A manager's own request needs an admin.
- **Approve can return 422.** The rules are checked again when approving (team coverage or balance may have changed). Show the violations.
- **Cancel:** works on `pending` and `approved` requests whose `endDate` is not in the past.

### Balances
| Method | Path | Roles | Returns |
|---|---|---|---|
| GET | `/balances/me?year=2027` | employee, manager (**admin gets 403**) | `UserBalance` |
| GET | `/balances/team?year=2027` | manager (own reports), admin (everyone except admins) | `UserBalance[]` |
| GET | `/balances/:userId?year=2027` | self, the user's manager, admin | `UserBalance` |

`year` defaults to the current year. A request counts towards the year of its **start date**.

### Calendar
| Method | Path | Roles | Returns |
|---|---|---|---|
| GET | `/calendar?from=2027-02-01&to=2027-02-28` | Any | `CalendarResponse` |

- Employees and managers get their own team. Admins get everyone.
- Only `pending` and `approved` leave is returned.
- Max range 400 days. A missing, invalid or reversed range gives 400.
- Weekends are not in `coverage`. Compute them in the UI from the date.
- Colour a day red when `coverage[date] >= maxTeamOffPerDay`. The server also blocks new requests there.

### Configuration (admin writes, everyone reads)
| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/settings` | Any | none | `Settings` |
| PUT | `/settings` | admin | `{ minNoticeDays?, maxTeamOffPerDay? }` (ints; notice 0-365, max off 1-1000) | `Settings` |
| GET | `/leave-types` | Any | none | `LeaveType[]` |
| POST | `/leave-types` | admin | `{ name, yearlyAllowance?, isPaid? }` (omit or `null` allowance = unlimited) | `LeaveType` (201) |
| PATCH | `/leave-types/:id` | admin | any of `name`, `yearlyAllowance`, `isPaid` | `LeaveType` |
| DELETE | `/leave-types/:id` | admin | none | `{ deleted: true }`. **409** if requests use it. |
| GET | `/holidays?year=2027` | Any | none | `PublicHoliday[]` |
| POST | `/holidays` | admin | `{ date, name }` | `PublicHoliday` (201). 409 if the date exists. |
| DELETE | `/holidays/:id` | admin | none | `{ deleted: true }` |

Changing a setting, allowance or holiday takes effect on the next request. No restart is needed. After a change, refetch the calendar, balances and previews.

### Users
| Method | Path | Roles | Body | Returns |
|---|---|---|---|---|
| GET | `/users` | admin | none | `User[]` |
| GET | `/users/reports` | manager | none | `User[]` (active direct reports) |
| POST | `/users` | admin | `{ name, email, password (min 8), role, managerId? }` | `User` (201) |
| PATCH | `/users/:id` | admin | any of `name`, `password`, `role`, `managerId`, `active` | `User` |

Rules: an `employee` **must** have a `managerId` pointing to a `manager`. Managers and admins get `managerId: null`. Emails are stored lower case, and a duplicate gives 409. An admin cannot deactivate or demote themselves (400). Password hashes are never returned.

---

## 4. Business rules (what the 422 `violations` mean)

| Code | Cause | UI hint |
|---|---|---|
| `INVALID_DATE` | Not a real calendar date | Inline error on the date field |
| `END_BEFORE_START` | End date is before the start date | Inline error on the end date |
| `CROSSES_YEAR` | Start and end are in different years | Tell the user to split it into two requests |
| `NO_WORKING_DAYS` | Only weekends or public holidays selected | Show 0 days |
| `MIN_NOTICE` | Starts sooner than `minNoticeDays` from today | Show the setting |
| `INSUFFICIENT_BALANCE` | More days than remaining (pending counted) | Show remaining |
| `OWN_OVERLAP` | Overlaps your own pending or approved request | Link to the clashing request |
| `TEAM_COVERAGE` | Too many teammates off on some day. `dates` lists them. | Highlight those days |

- **Working days** exclude Saturdays, Sundays and public holidays. `days` is what is deducted.
- **Balance** = allowance - approved days - pending days, per leave type and year. Cancelled and rejected requests give the days back.
- **Team coverage** counts pending and approved requests of teammates, including the manager, on each working day.
- **Defaults:** minimum notice 2 days, max 2 people off per day. Annual 20 days, Sick 10 days, Unpaid unlimited.

### Status lifecycle
```
pending  -> approved   (approve)
pending  -> rejected   (reject)
pending  -> cancelled  (cancel)
approved -> cancelled  (cancel)
rejected / cancelled   (final)
```
Any other change returns **409**.

---

## 5. Frontend tips

### Request form (live feedback)
Call `POST /leave-requests/preview` (debounced about 400 ms) whenever the leave type or dates change and both dates are filled in. Show `days`, `remainingAfter` and each `violations[].message`. Disable submit while `valid` is `false`, but still handle a 422 on the real submit, because data can change in between.

### Which buttons to show
- **Cancel:** `status` is `pending` or `approved` and `endDate >= today`, and the user is the owner, the owner's manager, or an admin.
- **Approve / Reject:** `status === 'pending'`, the request is not your own, and you are the owner's manager (or an admin for a manager's request).

### Refreshing after changes (TanStack Query)
After create, approve, reject or cancel, invalidate these query keys: requests (mine and inbox), balances and calendar. Cancelling then updates the balance chart on screen.

### Balance chart
For each `BalanceLine` with a non-null `allowance`, show a stacked bar of `used`, `pending` and `remaining`. For `allowance === null` (Unpaid), show just `used` and `pending` with an "Unlimited" label. Don't draw a bar against a total.

### Role-based routes
| Page | Roles |
|---|---|
| Dashboard (balances, my requests), New request | employee, manager |
| Team calendar | all |
| Approvals inbox | manager, admin |
| Team balances | manager, admin |
| Admin (settings, leave types, holidays, users) | admin |

Send admins to the inbox or admin page after login, because `/balances/me` and requesting leave return 403 for them.

---

## 6. Demo accounts

Password for every account: `Password123!`

| Role | Email | Notes |
|---|---|---|
| admin | `admin@example.com` | |
| manager | `manager1@example.com` | Team A: employees 1-4 |
| manager | `manager2@example.com` | Team B: employees 5-8 |
| employee | `employee1@example.com` ... `employee8@example.com` | |

User ids depend on the seed. Today the admin is 1, managers are 2 and 3, and employees are 4-11. **Never hardcode ids**; read them from the API.

The seed also creates 40 requests in all four statuses, spread from about 200 days ago to 60 days ahead, plus holidays for last year, this year and next year.

---

## 7. Quick checks (PowerShell)

```powershell
$base = "http://localhost:3000"
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" `
  -Body '{"email":"employee1@example.com","password":"Password123!"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

Invoke-RestMethod -Uri "$base/auth/me" -Headers $h
Invoke-RestMethod -Uri "$base/balances/me" -Headers $h
Invoke-RestMethod -Uri "$base/calendar?from=2027-02-01&to=2027-02-28" -Headers $h
```

## 8. Tests

`npm test` in `backend` runs 92 tests on an in-memory Postgres. It does not touch your Neon data. The e2e specs in `backend/test` are good examples of valid and invalid request bodies.
