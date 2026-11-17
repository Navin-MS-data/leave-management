import { useState } from "react";
import { errorMessage } from "../api/client";
import { useLeaveTypes, useTeamBalances } from "../api/hooks";
import type { BalanceLine } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Empty, Loading, Note, PageHeader, YearStepper } from "../components/ui";
import { todayISO, yearOf } from "../lib/dates";

export function TeamBalances() {
  const { user } = useAuth();
  const [year, setYear] = useState(yearOf(todayISO()));
  const balances = useTeamBalances(year);
  const types = useLeaveTypes();
  const data = balances.data;

  return (
    <>
      <PageHeader
        title="Team balances"
        running={`${user?.role === "admin" ? "Everyone" : "Your reports"} · leave year ${year}`}
        actions={<YearStepper year={year} onChange={setYear} />}
      />

      {balances.isPending ? <Loading label="Loading balances" /> : null}
      {balances.isError ? <Note tone="error">{errorMessage(balances.error)}</Note> : null}
      {data && data.length === 0 ? (
        <Empty title="No people to show">Nobody reports to you yet.</Empty>
      ) : null}

      {data && data.length > 0 && types.data ? (
        <div className="panel panel--flush panel--table">
          <div className="table-wrap">
            <table className="ledger ledger--team ledger--stack">
              <caption className="visually-hidden">Remaining leave by person for {year}</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  {types.data.map((t) => (
                    <th key={t.id} scope="col" className="r">
                      {t.name}
                      <span className="th-sub num">
                        {t.yearlyAllowance === null ? "unlimited" : `of ${t.yearlyAllowance}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((person) => (
                  <tr key={person.userId}>
                    <th scope="row">{person.userName}</th>
                    {types.data.map((t) => (
                      <td key={t.id} className="r" data-label={t.name}>
                        <Cell line={person.balances.find((b) => b.leaveTypeId === t.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Cell({ line }: { line?: BalanceLine }) {
  if (!line) return <span>—</span>;
  if (line.allowance === null) {
    // No allowance, so no bar: say plainly what is posted and what is only pencilled.
    return (
      <span className="cell-word">
        <span className="num">{line.used}</span> posted
        {line.pending > 0 ? (
          <>
            , <span className="num">{line.pending}</span> pencilled
          </>
        ) : null}
      </span>
    );
  }
  const total = line.allowance || 1;
  const posted = (line.used / total) * 100;
  const pencilled = (line.pending / total) * 100;
  const low = (line.remaining ?? 0) <= Math.ceil(line.allowance * 0.15);
  return (
    <span className="cell">
      <span className={`num cell-remaining${low ? " is-low" : ""}`}>{line.remaining}</span>
      <span className="minibar" aria-hidden="true">
        <i className="minibar-posted" style={{ width: `${posted}%` }} />
        <i className="minibar-pencilled" style={{ width: `${pencilled}%` }} />
      </span>
      <span className="visually-hidden">
        {line.remaining} remaining, {line.used} posted, {line.pending} pending
      </span>
    </span>
  );
}
