import type { BalanceLine } from "../api/types";

/** Largest tally drawn for a type with no limit, so a long year never overflows the row. */
const TALLY_CAP = 40;

/**
 * One long bar per account line: posted days solid, pencilled days hatched, the rest open.
 * The scale is the line's own allowance, so a full bar always means "nothing left". A type with no
 * limit has no scale, so it is drawn as a tally of day marks on an open-ended rule instead.
 * Decorative: the figures beside it carry the same numbers.
 */
export function Meter({ line }: { line: BalanceLine }) {
  if (line.allowance === null) {
    const posted = Math.min(line.used, TALLY_CAP);
    const pencilled = Math.min(line.pending, TALLY_CAP - posted);
    return (
      <div className="meter meter--tally" aria-hidden="true">
        {Array.from({ length: posted }, (_, i) => (
          <span key={`p${i}`} className="meter-tick meter-tick--posted" />
        ))}
        {Array.from({ length: pencilled }, (_, i) => (
          <span key={`n${i}`} className="meter-tick meter-tick--pencilled" />
        ))}
      </div>
    );
  }

  const postedShare = Math.min(100, (line.used / line.allowance) * 100);
  const pencilledShare = Math.min(100 - postedShare, (line.pending / line.allowance) * 100);

  return (
    <div className="meter" aria-hidden="true">
      <span className="meter-posted" style={{ width: `${postedShare}%` }} />
      <span className="meter-pencilled" style={{ width: `${pencilledShare}%` }} />
    </div>
  );
}

export function MeterLegend() {
  return (
    <ul className="meter-legend" aria-label="How to read the bars">
      <li>
        <span className="swatch swatch--posted" /> Posted (approved)
      </li>
      <li>
        <span className="swatch swatch--pencilled" /> Pencilled (pending)
      </li>
      <li>
        <span className="swatch swatch--open" /> Remaining
      </li>
    </ul>
  );
}
