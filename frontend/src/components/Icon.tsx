/** One authored icon set: 24px grid, 1.6 stroke, round caps. */
const PATHS = {
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z M5 17a3 3 0 0 1 3-3h11',
  plus: 'M12 5v14 M5 12h14',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z M4 10h16 M8 3v4 M16 3v4',
  inbox: 'M4 13l2-8h12l2 8v6H4z M4 13h5l1 2h4l1-2h5',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16.5 11a2.5 2.5 0 1 0 0-5 M17 14.2a5 5 0 0 1 4 4.8',
  sliders: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logout: 'M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12 M18 6L6 18',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  trash: 'M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
