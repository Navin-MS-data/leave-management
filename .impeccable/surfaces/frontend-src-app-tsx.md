---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface brief: Leave app (all screens)

Scope: the whole React web app in `frontend/`. Mode: Operate. Build path: code-led.

Audience and job: employees request leave and watch their balance; managers decide on reports' requests with coverage in view; admins set the rules. First viewer is a hiring reviewer in a live demo. Constraints: roles enforced by the API; dates are plain YYYY-MM-DD strings; WCAG AA; Monday-first calendar; English only. Synthetic demo data.

## Direction contract

THESIS: Leave is a passbook, not a form. Days are the currency: pending days are pencilled in, approved days are posted in ink, cancelled days are reversed, never erased. The category-default arrangement it refuses is the grey card dashboard with a hero number and an accent colour.

OWN-WORLD: Committed bottle-green shell (rail and top bar) over a pale security-print tint ground. Ink is near-black green; posting ink is violet-blue (franking stamp) for approved; red is reserved for rejected and over-limit; pencil is graphite grey with a diagonal hatch for pending. Public Sans for text, Spline Sans Mono for dates, amounts and running balances, all tabular. Fine 1px rules, dense rows, square-ish 2px corners. Standard web controls only; the world enters through type, palette, density and one signature move.

STORY: The user understands, before they submit, exactly what a request would do to their balance and to the team's coverage. They submit with confidence, see the entry pencilled in, and a manager posts it or stamps it rejected. Cancelling visibly reverses the entry and returns the days.

FIRST VIEWPORT: Left rail (Passbook, nav by role, user and sign out), top bar with year. Main: the balance statement. Three account lines (Annual, Sick, Unpaid) each as a ledger row with allowance, posted, pencilled, remaining and a single long bar showing posted solid, pencilled hatched, remaining open. Below, "Entries": my requests as a table with a running "Balance after" column, status as stamp, and a Cancel action. The primary action "New request" sits top right of the main column.

FORM: Candidate 5 of my own list: bank passbook with running balance and pencilled vs posted entries (list: wall year-planner, attendance register, duty roster, railway timetable, bank passbook, jet-age ticket wallet, International Typographic calendar). seed:186e96d9ad7e8a5d. Signature move: the pencil-to-ink entry. On the request form a live pencilled entry shows days and balance after; on approval it becomes ink with a violet stamp; cancel strikes it and adds a reversal line. Raised by challengers: running head naming the span in view on calendar and tables (lexicon guide words); approve auto-advances to the next pending request (vertical feed); unavailable days drop out of choice (airport signage).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Product name "Passbook" is a placeholder.
- The decision page and re-roll were not offered because the user said to proceed; offer a re-roll afterwards.
