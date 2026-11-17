import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BalanceLine } from "../api/types";

interface Row {
  name: string;
  posted: number;
  pencilled: number;
  remaining: number;
  /** A type with no allowance has no "remaining" to draw. */
  unlimited: boolean;
}

function toRows(balances: BalanceLine[]): Row[] {
  return balances.map((b) => ({
    name: b.leaveTypeName,
    posted: b.used,
    pencilled: b.pending,
    remaining: b.remaining ?? 0,
    unlimited: b.allowance === null,
  }));
}

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="chart-tip">
      <strong>{row.name}</strong>
      <span>
        <span className="num">{row.posted}</span> posted
      </span>
      <span>
        <span className="num">{row.pencilled}</span> pencilled
      </span>
      <span>{row.unlimited ? "No limit" : <><span className="num">{row.remaining}</span> remaining</>}</span>
    </div>
  );
}

/**
 * Days per leave type: posted (approved), pencilled (pending) and what is left, on one shared days axis.
 * Types with no allowance (Unpaid) show only what has been taken.
 * The ledger beside it carries the same numbers as text, so the chart is described, not relied on.
 */
export function BalanceChart({ balances }: { balances: BalanceLine[] }) {
  const rows = toRows(balances);
  const summary = rows
    .map((r) =>
      r.unlimited
        ? `${r.name}: ${r.posted} posted, ${r.pencilled} pencilled, no limit`
        : `${r.name}: ${r.posted} posted, ${r.pencilled} pencilled, ${r.remaining} remaining`,
    )
    .join(". ");

  return (
    <figure className="chart" role="img" aria-label={`Days by leave type. ${summary}.`}>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 220 }}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barSize={22}>
            <defs>
              <pattern id="passbook-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect className="hatch-ground" width="5" height="5" />
                <line className="hatch-line" x1="0" y1="0" x2="0" y2="5" strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid horizontal={false} className="chart-grid" />
            <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={64}
              tickLine={false}
              axisLine={false}
              className="chart-axis--names"
            />
            <Tooltip content={<Tip />} cursor={{ fill: "transparent" }} />
            <Bar dataKey="posted" stackId="days" className="bar-posted" isAnimationActive={false} />
            <Bar dataKey="pencilled" stackId="days" className="bar-pencilled" isAnimationActive={false} />
            <Bar dataKey="remaining" stackId="days" className="bar-open" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
