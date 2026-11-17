---
name: Passbook
description: Leave as a bank passbook. Pending days are pencilled in, approved days are posted in ink, cancelled days are reversed, never erased.
world: "186e96d9ad7e8a5d"
colors:
  green-950: "oklch(0.2 0.04 165)"
  green-900: "oklch(0.26 0.05 165)"
  green-800: "oklch(0.32 0.06 165)"
  green-700: "oklch(0.38 0.07 165)"
  green-600: "oklch(0.46 0.08 165)"
  on-green: "oklch(0.96 0.015 165)"
  on-green-2: "oklch(0.82 0.03 165)"
  paper: "oklch(0.978 0.01 170)"
  paper-2: "oklch(0.955 0.016 170)"
  paper-3: "oklch(0.925 0.02 170)"
  line: "oklch(0.87 0.02 170)"
  line-strong: "oklch(0.74 0.03 170)"
  ink: "oklch(0.23 0.03 175)"
  ink-2: "oklch(0.4 0.03 175)"
  ink-3: "oklch(0.48 0.03 175)"
  stamp: "oklch(0.42 0.17 285)"
  stamp-bg: "oklch(0.94 0.035 285)"
  stamp-line: "oklch(0.7 0.1 285)"
  tint: "oklch(0.95 0.025 165)"
  tint-line: "oklch(0.78 0.045 165)"
  pencil: "oklch(0.46 0.015 250)"
  pencil-bg: "oklch(0.935 0.008 250)"
  pencil-line: "oklch(0.7 0.012 250)"
  red: "oklch(0.5 0.18 27)"
  red-bg: "oklch(0.955 0.03 27)"
  red-line: "oklch(0.72 0.12 27)"
  amber: "oklch(0.43 0.1 70)"
  amber-bg: "oklch(0.95 0.06 85)"
  amber-line: "oklch(0.78 0.12 80)"
typography:
  headline:
    fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.5
  figure:
    fontFamily: "'Spline Sans Mono Variable', 'Spline Sans Mono', ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
    fontFeature: "'tnum'"
  stamp:
    fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.07em"
rounded:
  base: "2px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.5rem"
  s6: "2rem"
  s7: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.green-700}"
    textColor: "#ffffff"
    rounded: "{rounded.base}"
    padding: "0.5rem 0.95rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.green-800}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
    padding: "0.5rem 0.95rem"
    height: "2.5rem"
  button-quiet-hover:
    backgroundColor: "{colors.paper-3}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
    rounded: "{rounded.base}"
    padding: "0.5rem 0.95rem"
    height: "2.5rem"
  button-sm:
    padding: "0.25rem 0.65rem"
    height: "2rem"
  input-field:
    backgroundColor: "oklch(0.997 0.003 170)"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0.5rem 0.65rem"
    height: "2.5rem"
  panel:
    backgroundColor: "oklch(0.992 0.006 170)"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "{spacing.s5}"
  rail:
    backgroundColor: "{colors.green-900}"
    textColor: "{colors.on-green}"
    width: "15rem"
  topbar:
    backgroundColor: "{colors.green-900}"
    textColor: "{colors.on-green-2}"
    height: "3.25rem"
  nav-link-active:
    backgroundColor: "{colors.green-700}"
    textColor: "#ffffff"
    rounded: "{rounded.base}"
  stamp-approved:
    backgroundColor: "{colors.stamp-bg}"
    textColor: "{colors.stamp}"
    rounded: "{rounded.base}"
    typography: "{typography.stamp}"
  stamp-pending:
    textColor: "{colors.pencil}"
    rounded: "{rounded.base}"
    typography: "{typography.stamp}"
  stamp-rejected:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
    rounded: "{rounded.base}"
    typography: "{typography.stamp}"
  stamp-cancelled:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.base}"
    typography: "{typography.stamp}"
  stamp-reversal:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.green-700}"
    rounded: "{rounded.base}"
    typography: "{typography.stamp}"
  note-error:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
    rounded: "{rounded.base}"
    padding: "0.75rem 1rem"
  note-warn:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber}"
    rounded: "{rounded.base}"
    padding: "0.75rem 1rem"
  note-info:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.green-800}"
    rounded: "{rounded.base}"
    padding: "0.75rem 1rem"
---

# Design System: Passbook

## Overview

**Creative North Star: "The Passbook"**

Leave is a bank passbook, not a form. Days are the currency. A request is first pencilled in (graphite, hatched), becomes ink when a manager posts it (violet franking stamp), and is never erased: a cancelled entry is struck through and followed by a reversal line that returns the days. Every screen is a ledger page: fine 1px rules, dense rows, square 2px corners, running figures in a tabular mono.

The world is a committed bottle-green shell (rail and top bar) over a pale, green-tinted security-print paper. Colour is spent on meaning, not decoration: violet means posted, graphite hatch means pending, red means rejected or over the limit, amber means at the limit or a holiday. Standard web controls carry the work; the world enters through palette, type, density, and one signature move, the pencil-to-ink entry.

The system refuses the grey card dashboard with a hero number and an accent colour. Rows and rules do the structuring; panels are flat and sit side by side, not inside each other.

**Key Characteristics:**
- Bottle-green shell over tinted paper; the ground is never white.
- Violet exists only for posted (approved) entries; all interface tint is green.
- Pending is drawn, not coloured: graphite on a 135-degree hatch.
- Dates, amounts and balances are set in tabular mono; prose in Public Sans.
- Flat, bordered, 2px-cornered, one long bar per account.
- One authored motion moment: the stamp landing. Everything else is a 0.15s colour fade.

## Colors

A green-and-paper palette with four reserved status inks; every status colour has a paired background tint and a line colour.

### Primary
- **Bottle Green** (`green-900`, oklch(0.26 0.05 165)): the shell. Rail and top bar fill. `green-950` is the login brand strip and the top bar's bottom rule; `green-800` is nav hover and the stepper on the dark bar; `green-700` is the primary button, active nav, today marker, links, and the caret/accent-color; `green-600` is the global focus ring on paper.
- **Shell Text** (`on-green` oklch(0.96 0.015 165), `on-green-2` oklch(0.82 0.03 165)): text and focus ring on the dark rail and top bar; `on-green-2` for secondary and inactive nav.

### Secondary
- **Franking Violet** (`stamp`, oklch(0.42 0.17 285)): posting ink. Used only for approved entries: the approved stamp, the posted segment of every meter and mini bar, the approved calendar chip, the posted bar in the chart. `stamp-bg` is the stamp fill; `stamp-line` is reserved for stamp edges.

### Tertiary
- **Graphite Pencil** (`pencil`, oklch(0.46 0.015 250), with `pencil-bg`, `pencil-line`): pending. Pending row text, hatch strokes (alpha 0.07 on rows, 0.16 to 0.2 on small swatches), dashed borders, coverage "taken" pips, the live entry preview's dashed edge.
- **Rejection Red** (`red`, oklch(0.5 0.18 27), with `red-bg`, `red-line`): rejected stamps, over-limit figures, field errors, violations, full-coverage days, blocked-day outline, danger button.
- **Limit Amber** (`amber`, oklch(0.43 0.1 70), with `amber-bg`, `amber-line`): at the limit but not failing: public holidays, team-at-capacity coverage rows, the pending-count badge on the nav.

### Neutral
- **Tinted Paper** (`paper` oklch(0.978 0.01 170), `paper-2`, `paper-3`): page ground and its two deeper steps (table heads and hover, weekend and open-bar fills).
- **Hairline** (`line` oklch(0.87 0.02 170), `line-strong` oklch(0.74 0.03 170)): row dividers and panel borders; strong for input borders, table head rule, double rule, meter outlines.
- **Green-Black Ink** (`ink` oklch(0.23 0.03 175), `ink-2`, `ink-3`): text, secondary text, tertiary and cancelled text. `ink-3` is the lowest tier of copy; never go lighter.
- **Interface Tint** (`tint` oklch(0.95 0.025 165), `tint-line`, link = `green-700`): selection, info notes, the selected request row, the reversal stamp, the "pencil-in" wash. A green tint on purpose, so violet stays reserved.

### Named Rules
**The Posting Ink Rule.** Violet appears only where a manager has posted an entry. Selection, links, info, focus and hover are green. If a violet element is not an approved entry, it is wrong.

**The Pencil Rule.** Pending is graphite plus a 135-degree hatch plus a dashed edge, never a colour alone. A pending thing must look unfinished next to a posted one.

**The Reserved Red Rule.** Red marks rejected or over-limit only. At-the-limit is amber. Never use red for emphasis or destructive-by-default chrome.

## Typography

**Text Font:** Public Sans Variable (fallback Public Sans, system-ui, sans-serif)
**Figures Font:** Spline Sans Mono Variable (fallback Spline Sans Mono, ui-monospace, monospace)

**Character:** a plain civic grotesque for reading and a tabular mono for the numbers a ledger lives on. The pair is functional: columns of dates and balances align to the digit.

### Hierarchy
- **Headline** (700, 1.8rem `--step-3`, 1.2, -0.02em): page `h1` (1.4rem `--step-2` under 54rem); also the large day count on the entry preview, in mono.
- **Title** (650, 1.125rem `--step-1`, 1.2, -0.01em): panel `h2`, brand wordmark (700), remaining-days figure (700), empty-state title.
- **Body** (400, 0.9375rem `--step-0`, 1.5): all copy and table text. `h3` is 650 at the same size.
- **Label** (650, 0.8125rem `--step--1`): table heads in `ink-2`, field labels in `ink`, hints, legends, running heads.
- **Figure** (mono, tabular-nums, -0.01em): every date, amount and balance, via the `.num` class. Weight 600 for date ranges, 700 for remaining.
- **Stamp** (700, 0.7rem, 0.07em, uppercase): status stamps only. Day-strip weekday letters (0.62rem uppercase) are the one other small caps use.

### Named Rules
**The Tabular Rule.** Anything that is counted, dated or balanced is mono and tabular. Prose and names are never mono.

## Layout

An app shell: a 15rem sticky rail (`--rail-w`) and a stage holding a sticky top bar and a main column capped at 78rem. Main padding is 2rem (`s6`) at the sides and 3rem (`s7`) at the foot. The top bar (min 3.25rem) carries today's date and, per page, the year or month stepper, so the page body stays about the work. Page headers sit above the content and close with a 3px double rule in `line-strong`, as a ledger closes a column of figures.

Spacing is a 4px-based scale (`s1` 0.25rem to `s7` 3rem). Content is dense: ledger cells pad 0.7rem by 1rem; panels pad 1.5rem; stacks gap 1rem. The statement screen is a two-column top (1.55fr table, 1fr chart) over a full-width entries table; the request form is a form plus a sticky 18 to 25rem preview; approvals is a 15 to 20rem request list beside a detail pane.

Responsive uses two breakpoints: under 62rem two-column layouts collapse to one and the sticky preview un-sticks. Under 54rem the rail becomes a top row with a horizontally scrolling nav strip with soft edge fades; ledger tables (`ledger--entries`, `ledger--stack`) become stacked rows with every value labelled (`data-label`); the month calendar becomes a one-line-per-day agenda that hides outside-month days; padding tightens to `s3` and `s4`.

## Elevation & Depth

Flat. Depth comes from tonal steps of paper (`paper` ground, a slightly lighter near-white for panels and inputs, `paper-2` heads and hovers) and 1px hairlines. There are no resting shadows. Two exceptions exist: the chart tooltip carries one soft, blurred, green-tinted shadow (0 4px 14px, alpha 0.14), and the selected request row has an inset 1px `tint-line` ring. The preview panel reads as "not yet real" through a dashed `pencil-line` border and `paper-2` fill, not through elevation.

### Named Rules
**The Flat Ledger Rule.** Never add a hard offset shadow, and never stack a card inside a card. Group with a rule or a new panel beside it.

## Shapes

Square and ruled. Radius is 2px everywhere (`--radius` and `--radius-lg` are both 2px): buttons, inputs, panels, notes, stamps, day cells, chips, pips. Meters use 1px. Borders are 1px hairlines; the stamp is the one doubled border (1.5px solid plus a 1px outline offset 2px, giving a double-outlined franking mark). Dashed borders mean pencilled or not-yet-real; dotted means cancelled or a correction pair; the double rule means "closed". Hatch is always 135 degrees. Documented exceptions to the 2px rule: the today marker on the calendar (a circle), the nav badge (a pill), and the scrollbar thumb.

## Components

### Buttons
- **Shape:** 2px corners, min height 2.5rem (sm 2rem), 600 weight, 0.15s colour fade.
- **Primary:** `green-700` fill, white text, hover `green-800`. One per view, e.g. New request.
- **Quiet:** transparent, `ink-2` text; hover `paper-3`. On the dark top bar the text is `on-green` and hover `green-700`.
- **Danger:** `red-bg` fill, `red` text, `red-line` border.
- **Icon / sm:** icon buttons are 2.5rem square-min; sm is 2rem. Disabled is 50% opacity, not-allowed cursor.
- **Link button:** underlined `link` green text, no chrome.

### Inputs / Fields
- **Style:** near-white fill, 1px `line-strong` border, 2px radius, 2.5rem tall. Labels above in 650 label size. Hint below in `ink-2`.
- **Focus:** the global ring, 2px `green-600`, offset 2px.
- **Error / Disabled:** `aria-invalid` turns the border `red`, with the message in `red` below. Disabled uses `paper-2` fill and `ink-3` text.

### Navigation
Rail: wordmark with a book icon, a vertical list of 500-weight links in `on-green-2` with 2px radius; hover `green-800`; active `green-700`, white, 600. The pending-count badge is an amber pill. User block pinned to the foot with a `green-700` top rule and a sign-out text button. Admin has a secondary subnav of underlined tabs (2px `green-700` underline when active). Under 54rem the nav is a scrolling strip with edge fades.

### Page header and top bar
H1 plus an optional `running` line (label size, `ink-2`, tabular) that names the span in view; actions to the right; closed by the double rule. The top bar is sticky `green-900` with today's date in mono and the page's year or month stepper.

### Panels
Flat, 1px `line` border, 2px corners, near-white fill, 1.5rem padding. `panel--flush` removes padding for tables, with a `panel-head` row ruled beneath. Panels sit beside or below one another; they never nest.

### Ledger tables
The core surface. Header row on `paper-2` in label type; cells ruled by 1px `line`; hover `paper-2`. Money columns right-aligned mono. Variants: `ledger--balance` (a line row plus a full-width bar row per account: allowance, posted, pencilled, remaining), `ledger--entries` (fixed column widths 23/10/7/15/14/31 so the Cancel confirmation never shifts columns; includes a running Balance-after column), `ledger--team`, `ledger--types`. Row states: pending rows are graphite text on a faint hatch; cancelled rows are struck through in `ink-3`; the reversal line below is `ink-2` with its day count in green, joined to the struck entry by a dotted rule; a request just made washes from `tint` to paper for 1.6s (the pencil-in).

### Stamps
Small uppercase bordered marks with a status word, so status is never colour-only. Approved: violet text on `stamp-bg`, double outline. Pending: graphite, dashed, hatched, no outline. Rejected: red on `red-bg`, double outline. Cancelled: `ink-3`, dotted. Reversal: green on `tint`. On a manager decision the stamp lands (0.55s: scale 1.9 and a -8deg turn settling to 1) using `--ease-out`.

### Meters
One long bar per account line: 0.7rem tall, `paper-3` track, 1px `line-strong` border; posted segment solid `stamp`, pencilled segment a graphite hatch, remaining left open, on the allowance's own scale. Unlimited leave types have no scale, so days are a tally of 0.45rem tick marks on a dashed baseline (posted solid, pencilled hatched with a dashed outline). A legend explains the bars, and every bar has a text equivalent. A `minibar` (5.5rem by 0.5rem) repeats the idea in team balances.

### Notes
Bordered 2px strips with an icon and text. Error: red set. Warn: amber set. Info: `tint` fill, `green-800` text. Default: `paper-2`.

### Stepper
A bordered group (year or month, with previous and next icon buttons and a 3.5rem centred value). Recoloured to `green-800` on the dark top bar.

### Calendar
A Monday-first month grid: cells 7rem tall, hairline borders, weekends on `paper-2`, outside-month on `paper-3`, holidays on `amber-bg` with the holiday name, full-capacity days on `red-bg` with a red count. Entries are 2px chips: approved solid `stamp` with white text, pending hatched with a dashed graphite edge; overflow reads "+n more". Today is a `green-700` circle on the date number. Under 54rem it becomes an agenda.

### Coverage pips and day strip
Coverage rows show one 0.8rem square pip per team slot: taken (graphite), this request (`green-700`), free (outline only); a row at capacity is amber and a row over is red with 600 weight, always with a count in text. The day strip on the request form shows one 2.15rem cell per day: counted days are graphite-hatched, weekends are dashed grey, holidays amber, blocked days get a red outline.

### Live entry preview (signature)
Beside the request form, a sticky dashed panel shows the entry as it would be pencilled: a large mono day count, the day strip, balance after (red when over), and either a green "ok" line or a list of red violations. It dims to 60% while checking.

### Chart
A Recharts stacked bar of days per leave type: posted in `stamp`, pencilled as a dashed hatched fill, open in `paper-3`; mono axis numbers, text-font names on the category axis, `line` gridlines. The figure carries a role of img and an aria-label summary.

### Empty and loading states
Empty: a 650 title at `step-1`, a 46ch `ink-2` explanation, and an action. Loading: a 0.65rem graphite dot pulsing between 100% and 25% opacity next to the message.

## Do's and Don'ts

### Do:
- **Do** use `stamp` violet only for posted (approved) entries, in stamps, meters, chips and chart bars.
- **Do** draw pending as graphite on a 135-degree hatch with a dashed edge, and put the status word in the stamp.
- **Do** set every date, amount and balance in the tabular mono (`.num`).
- **Do** keep corners at 2px, borders at 1px hairlines, and structure with rules and rows.
- **Do** close page headings with the 3px double rule in `line-strong`.
- **Do** reverse, never erase: a cancelled entry is struck through and followed by a reversal line returning the days.
- **Do** pair every status and coverage colour with text, a pattern or a count; give charts an aria-label summary.
- **Do** show focus with the global 2px `green-600` ring, and `on-green` on the rail and top bar.
- **Do** honour `prefers-reduced-motion`: all animation and transition durations collapse to near zero.

### Don't:
- **Don't** use violet for selection, links, info, hover or focus; those are green.
- **Don't** use red for anything but rejected or over-limit; at-the-limit is amber.
- **Don't** add kickers or eyebrows above headings.
- **Don't** use side-stripe (thick left or right) borders as accents.
- **Don't** nest cards or panels inside panels.
- **Don't** use hard offset shadows; the system is flat.
- **Don't** use glyph or emoji icons; use the authored 24px, 1.6-stroke SVG icon set.
- **Don't** use pure white as the ground; paper is always tinted (white appears only as text on green or on the green primary button).
- **Don't** make a hero-number grey card dashboard.
