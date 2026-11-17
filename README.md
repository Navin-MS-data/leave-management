# Leave Management

A web app for requesting, approving and tracking employee leave. Employees request leave and watch their balance, managers decide on their own team's requests with the coverage impact in view, and admins set the rules.

The interface is called **Passbook**: leave works like a bank passbook. Pending days are *pencilled in*, approved days are *posted in ink*, and cancelled days are *reversed* with a visible reversal line, never erased.

## What it does

| Role | Can |
|---|---|
| **Employee** | Request leave, watch the balance, cancel their own requests, see their team calendar |
| **Manager** | Everything an employee can, plus approve or reject requests from their own reports and see their team's balances. A manager's own leave is decided by an admin. |
| **Admin** | Manage leave types, public holidays, people and the rules; decide on managers' requests; see everyone's calendar and balances. Admins do not request leave. |

Roles are enforced **on the server**. The interface hides what a role cannot do, but a hand-typed URL or API call is still refused (`403`).

### Business rules

Every request is checked against these rules, in the browser for instant feedback and again on the server, which has the last word. The rules live in one pure module, [`backend/src/leave-requests/leave-rules.ts`](backend/src/leave-requests/leave-rules.ts), so they are easy to test.

| Rule | Behaviour |
|---|---|
| Dates | End date cannot be before the start date. A request cannot span two calendar years. |
| Working days | Weekends and public holidays are never counted as leave days. |
| Balance | A request cannot exceed the remaining balance. **Pending requests count against it.** |
| Notice | A request must start at least *N* days from today (admin setting, default 2). |
| Own overlap | An employee cannot have two overlapping pending or approved requests. |
| Team coverage | No more than *N* people from one team can be off on the same working day (admin setting, default 2). Pending requests count. |
| Workflow | `pending` → `approved` or `rejected`. Pending and approved can be `cancelled` until the leave has ended. |
| Cancelling | Returns the days to the balance. Balances are **derived** from active requests, never stored, so rejecting or cancelling restores them automatically. |
| Approving | Re-checks every rule at approval time, because settings or other requests may have changed since the request was made. |

Admin-configurable with no code change: the **yearly allowance of each leave type**, the **minimum notice days**, and the **maximum team members off per day**.

### Screens

- **Statement** (employee, manager): balance ledger with a bar per leave type, a chart of days by leave type, and every request as an entry with a running "balance after".
- **New request**: a live "pencilled entry" shows the working days counted, the balance after, the days skipped (with holiday names) and any rule the request would break, *before* you submit.
- **Approvals** (manager, admin): decide on a request with the day-by-day coverage impact beside it. Approving moves to the next request.
- **Team calendar**: month view of who is off, with how close each day is to the coverage limit.
- **Team balances** (manager, admin): every person's remaining days per leave type.
- **Rules & setup** (admin): rules, leave types, public holidays and people.

## Tech stack

| | |
|---|---|
| **Backend** | NestJS 10, TypeORM, PostgreSQL, JWT auth (Passport), `class-validator`, `bcryptjs` |
| **Frontend** | React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, Recharts. Hand-built components and plain CSS, no UI library. |
| **Database** | PostgreSQL. Developed against [Neon](https://neon.tech); any PostgreSQL works. |
| **Tests** | Jest (backend, including end-to-end tests on an in-memory Postgres) and Vitest + Testing Library (frontend) |

## Getting started

### Prerequisites

- **Node.js** and npm. Developed on Node 22.
- A **PostgreSQL** database and its connection string. A free [Neon](https://neon.tech) project works well.

### 1. Install

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. On Neon, use the **pooled** string (host contains `-pooler`). |
| `DATABASE_URL_DIRECT` | Optional. A direct (non-pooled) string, used for schema changes and seeding. Falls back to `DATABASE_URL`. |
| `JWT_SECRET` | A long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | API port. Default `3000`. |
| `CORS_ORIGIN` | Allowed browser origin(s), comma-separated. Default `http://localhost:5173`. |
| `DB_SYNCHRONIZE` | `true` creates and updates tables on start (fine for development). Set `false` in production. |

`backend/.env` is git-ignored. Never commit it.

The frontend needs no configuration for local use. It talks to `http://localhost:3000` unless you set `VITE_API_URL` (see `frontend/.env.example`).

### 3. Seed demo data

```bash
cd backend
npm run seed
```

> **This wipes the database** and recreates it. It creates 1 admin, 2 managers, 8 employees, 3 leave types, public holidays for last, this and next year, and 40 leave requests in mixed states (pending, approved, rejected, cancelled), each checked against the real rules engine. Log in again afterwards, because old tokens stop working.

### 4. Run

In two terminals:

```bash
# Terminal 1: API on http://localhost:3000
cd backend
npm run start:dev

# Terminal 2: web app on http://localhost:5173
cd frontend
npm run dev
```

Open <http://localhost:5173>.

### Demo accounts

The password for every account is `Password123!`. The sign-in page has buttons that fill these in.

| Role | Email | Name | Team |
|---|---|---|---|
| Admin | `admin@example.com` | Alex Admin | Everyone. Decides managers' requests. |
| Manager | `manager1@example.com` | Maria Manager | Team A |
| Manager | `manager2@example.com` | Marcus Manager | Team B |
| Employee | `employee1@example.com` | Emma Stone | Team A (Maria) |
| Employee | `employee2@example.com` | Liam Brown | Team A (Maria) |
| Employee | `employee3@example.com` | Olivia Davis | Team A (Maria) |
| Employee | `employee4@example.com` | Noah Wilson | Team A (Maria) |
| Employee | `employee5@example.com` | Ava Martin | Team B (Marcus) |
| Employee | `employee6@example.com` | Ethan Clark | Team B (Marcus) |
| Employee | `employee7@example.com` | Mia Lopez | Team B (Marcus) |
| Employee | `employee8@example.com` | Lucas Kim | Team B (Marcus) |

A manager decides on the employees in their own team, and an admin decides on the managers. To see the approval flow, sign in as `manager1@example.com`. How many requests are waiting depends on when you ran the seed, because its dates are relative to today.

Seeded settings: minimum notice 2 days, at most 2 people off per team per day. Leave types: Annual 20 days, Sick 10 days, Unpaid with no limit. The holidays are fictional.

## Tests

```bash
cd backend  && npm test        # 112 tests: rules, workflow, roles, seed, validation
cd frontend && npm test        # 26 tests: dates, ledger, form schema, route guard, statement
cd frontend && npm run build   # type-checks, then builds
```

The backend tests run against an **in-memory Postgres (pg-mem)**, so they need no database and never touch your data. To run them against a real database instead, set `DATABASE_URL_TEST` to a separate, empty database or Neon branch.

## Project structure

```
backend/
  src/
    leave-requests/   request workflow and the pure rules engine (leave-rules.ts)
    balances/         derived balances per person and per team
    calendar/         team calendar and per-day coverage
    leave-types/ settings/ holidays/ users/    admin configuration
    auth/ common/     JWT login, role guards, date helpers
    entities/ seed/   TypeORM entities and the demo-data seed
  test/               end-to-end and rule tests
  API.md              endpoint and type reference
frontend/
  src/
    pages/            Statement, NewRequest, Approvals, Calendar, TeamBalances, Admin, Login
    components/       shell, chart, meters, shared UI
    api/              typed client and TanStack Query hooks
    lib/              date and ledger helpers
    styles/           design tokens, base and component styles
PRODUCT.md            who it is for and what it must do
DESIGN.md             the visual system (colours, type, components, rules)
```

## API

All endpoints, request and response types, the error format and the meaning of each rule violation are in [`backend/API.md`](backend/API.md). Everything except `POST /auth/login` needs a `Bearer` token. Business-rule failures return `422` with a `violations` array naming each broken rule.

## Design

The interface is deliberately not a generic dashboard. [`PRODUCT.md`](PRODUCT.md) records the product's users, purpose and constraints; [`DESIGN.md`](DESIGN.md) records the visual system as built: a bottle-green shell, violet "posting ink" used **only** for approved entries, graphite hatching for pending, and red reserved for rejected and over-limit. It is responsive down to a 390px phone, where tables become labelled stacked rows and the calendar becomes a one-line-per-day agenda.

## Notes and known limitations

- **Dates are plain `YYYY-MM-DD` strings** with no time zone, end to end. Do not parse them with `new Date("2027-02-01")` for display.
- **Unavailable days are flagged, not hidden.** The date pickers still let you choose a weekend or holiday; the live preview shows it is not counted, and a request with no working days is refused.
- **Approve and reject take a few seconds against a remote database.** Each call re-checks every rule in a transaction. The buttons show "Approving…" meanwhile. On a local database it is instant.
- **Accessibility** targets WCAG AA by design (keyboard operation, visible focus, status never shown by colour alone, reduced motion respected), but contrast and screen-reader behaviour have not been formally audited.
- English only, and the calendar week starts on Monday.
