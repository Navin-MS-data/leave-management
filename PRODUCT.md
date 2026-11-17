# Product

<!-- impeccable:product-schema 1 -->

<!-- Inferred from the project brief and conversation, not from an interview. Items marked (assumed) were not confirmed by the user and can be changed. -->

## Platform

web

## Stack

Delegated (the user asked to proceed without choosing). Chosen: React 18 + TypeScript + Vite, React Router, TanStack Query, React Hook Form + Zod, Recharts for the balance chart, Axios or fetch for the API. The earlier plan listed MUI; it is dropped in favour of hand-built components and plain CSS so the interface carries its own visual world instead of a stock component library (assumed). Backend: NestJS API in `backend/` (see `backend/API.md`), PostgreSQL on Neon.

## Users

Staff of a company with three roles on one app:
- **Employees** request leave, watch their balance, cancel requests, and check who else is off.
- **Managers** (two, each with four reports) decide on their reports' requests and check team coverage. They also request leave themselves, decided by an admin.
- **Admins** set the rules (yearly allowances, minimum notice days, maximum team members off per day), manage leave types, public holidays and users, and decide on managers' requests. Admins do not request leave.

First audience for this build is hiring reviewers evaluating a one-week full-stack project in a short live demo plus a 5-minute recording (assumed). The interface should read as a real internal tool to the reviewers.

## Product Purpose

Employees request leave, managers approve or reject it, and balances are tracked per leave type. A request must respect the employee's remaining balance and the team's coverage limit. Success is a request form that tells the user, before submit, how many working days it uses and which rule it would break, and a manager who can decide with the coverage impact in view.

## Positioning

The rules are visible while the user works, not discovered after a rejection: live day count (weekends and public holidays excluded), balance with pending days counted, and a team calendar that shows how close each day is to the coverage limit. A neighbouring HR tool that only records requests could not claim this.

## Operating Context

- Requests are made on working days in a company calendar with public holidays; weekends and holidays never count as leave days.
- Pending requests already count against balance and team capacity, so a cancel or rejection gives days back immediately.
- A team is a manager plus their direct reports. The calendar shows one team; admins see everyone.
- Admin-set values change behaviour with no code change; the UI must show the current values where they matter (for example the notice period on the form).
- Demo accounts exist with password `Password123!` (see `backend/API.md`). Demo data is synthetic.

## Capabilities and Constraints

- Server enforces roles; the UI hides what a role cannot do but never relies on that.
- Dates are plain `YYYY-MM-DD` strings with no time zone; never display them via `new Date("YYYY-MM-DD")`.
- A request cannot cross a calendar year. Leave types: Annual (20 days), Sick (10), Unpaid (unlimited, shown as such).
- Request statuses: pending, approved, rejected, cancelled. Only pending can be decided; pending and approved can be cancelled until the leave has ended.
- Approving can still fail on the server (rules re-checked); the UI must show those violations.
- Calendar week starts Monday (assumed). English only (assumed). Calendar and balance charts must work without relying on colour alone.
- Extras such as an AI team-availability summary are undecided and not part of this build.

## Brand Commitments

None confirmed. A product name has not been chosen; working name "Leave" is a placeholder (assumed).

## Evidence on Hand

- A working API with 92 passing tests and seed data: 1 admin, 2 managers, 8 employees, 3 leave types, public holidays, 40 requests in all four statuses (synthetic).
- No logo, brand assets, screenshots or user research exist. Do not invent customers, testimonials or metrics.

## Product Principles

1. Show the rule before the rejection: every number that decides a request is visible while the user is deciding.
2. Pending counts. Balance and coverage always include requests not yet decided, and the UI says so.
3. Each role sees only its own work; hidden controls are a courtesy, the server is the authority.
4. A decision takes seconds: the manager sees who, when, how many days and the coverage impact in one row.
5. Dates and day counts are exact and unambiguous: weekday shown, working days vs calendar days never mixed.

## Accessibility & Inclusion

Target WCAG AA (assumed): full keyboard operation including the calendar, visible focus, status and coverage not conveyed by colour alone, sufficient contrast, reduced-motion respected.
