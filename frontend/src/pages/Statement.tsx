import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useCancelRequest, useLeaveTypes, useMyBalance, useMyRequests } from "../api/hooks";
import type { BalanceLine } from "../api/types";
import { BalanceChart } from "../components/BalanceChart";
import { Icon } from "../components/Icon";
import { Meter, MeterLegend } from "../components/Meter";
import { TopbarControls } from "../components/Topbar";
import { Empty, Loading, Note, PageHeader, StatusStamp, YearStepper } from "../components/ui";
import { fmtRange, todayISO, yearOf } from "../lib/dates";
import { buildEntries, canCancel, isActive } from "../lib/ledger";

interface StatementState {
  flash?: string;
  /** The request just made, so its pencilled line can be drawn in as the page opens. */
  freshId?: number;
}

export function Statement() {
  const today = todayISO();
  const location = useLocation();
  const navigate = useNavigate();
  const [year, setYear] = useState(yearOf(today));
  const [arrival] = useState<StatementState>(() => (location.state as StatementState | null) ?? {});
  const { flash, freshId } = arrival;
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const balance = useMyBalance(year);
  const requests = useMyRequests();
  const types = useLeaveTypes();
  const cancel = useCancelRequest();

  // The flash message is shown once, then removed from history so a refresh does not repeat it.
  useEffect(() => {
    if (flash || freshId) navigate(location.pathname, { replace: true, state: null });
  }, [flash, freshId, navigate, location.pathname]);

  const entries = useMemo(
    () => (requests.data && types.data ? buildEntries(requests.data, types.data, year) : []),
    [requests.data, types.data, year],
  );

  return (
    <>
      <TopbarControls>
        <YearStepper year={year} onChange={setYear} />
      </TopbarControls>

      <PageHeader
        title="Statement"
        running={`Leave year ${year}`}
        actions={
          <Link to="/new" className="btn btn--primary">
            <Icon name="plus" />
            New request
          </Link>
        }
      />

      {flash ? (
        <Note tone="info" live>
          {flash}
        </Note>
      ) : null}

      <div className="statement-top">
        <section className="panel panel--balance" aria-labelledby="balances-title">
          <div className="panel-head panel-head--row">
            <h2 id="balances-title">Balance</h2>
            <MeterLegend />
          </div>
          {balance.isPending ? <Loading label="Loading balance" /> : null}
          {balance.isError ? (
            <Note tone="error">
              {errorMessage(balance.error)}{" "}
              <button type="button" className="link-btn" onClick={() => balance.refetch()}>
                Try again
              </button>
            </Note>
          ) : null}
          {balance.data ? <LedgerTable lines={balance.data.balances} /> : null}
        </section>

        {balance.data ? (
          <section className="panel panel--chart" aria-labelledby="chart-title">
            <h2 id="chart-title">Days by leave type</h2>
            <BalanceChart balances={balance.data.balances} />
          </section>
        ) : null}
      </div>

      <section className="panel panel--flush" aria-labelledby="entries-title">
        <div className="panel-head">
          <h2 id="entries-title">Entries</h2>
          <p className="muted small">
            In date order. Balance after shows what is left once that entry is counted.
          </p>
        </div>

        {cancel.isError ? <Note tone="error">{errorMessage(cancel.error)}</Note> : null}
        {requests.isPending || types.isPending ? <Loading label="Loading entries" /> : null}
        {requests.isError ? <Note tone="error">{errorMessage(requests.error)}</Note> : null}

        {requests.data && types.data && entries.length === 0 ? (
          <Empty
            title={`No entries for ${year}`}
            action={
              <Link to="/new" className="btn btn--primary">
                <Icon name="plus" />
                New request
              </Link>
            }
          >
            Requests you make will be pencilled in here, then posted once approved.
          </Empty>
        ) : null}

        {entries.length > 0 ? (
          <div className="table-wrap">
            <table className="ledger ledger--entries">
              <caption className="visually-hidden">Leave entries for {year}</caption>
              <thead>
                <tr>
                  <th scope="col">Dates</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="r">
                    Days
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="r">
                    Balance after
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ request, kind, balanceAfter }) => {
                  const range = fmtRange(request.startDate, request.endDate);

                  if (kind === "reversal") {
                    return (
                      <tr key={`${request.id}-reversal`} className="is-reversal">
                        <td>
                          <span className="num dates">Reversal of {range}</span>
                          <span className="sub">Days handed back to {request.leaveType?.name}</span>
                        </td>
                        <td data-label="Type">{request.leaveType?.name}</td>
                        <td className="r num" data-label="Days">
                          +{request.days}
                        </td>
                        <td>
                          <span className="stamp stamp--reversal">Reversal</span>
                        </td>
                        <td className="r" data-label="Balance after">
                          <Balance value={balanceAfter} />
                        </td>
                        <td />
                      </tr>
                    );
                  }

                  const active = isActive(request.status);
                  const confirming = confirmId === request.id;
                  const rowClass = [
                    active ? "" : "is-reversed",
                    request.status === "pending" ? "is-pending" : "",
                    request.id === freshId ? "is-fresh" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={request.id} className={rowClass || undefined}>
                      <td>
                        <span className="num dates">{range}</span>
                        <span className="sub">{request.reason}</span>
                        {request.decisionNote ? (
                          <span className="sub">Manager note: {request.decisionNote}</span>
                        ) : null}
                      </td>
                      <td data-label="Type">{request.leaveType?.name}</td>
                      <td className="r num" data-label="Days">
                        {request.days}
                      </td>
                      <td>
                        <StatusStamp status={request.status} />
                      </td>
                      <td className="r" data-label="Balance after">
                        {active ? <Balance value={balanceAfter} /> : <span aria-label="No change">—</span>}
                      </td>
                      <td className="r">
                        {canCancel(request, today) ? (
                          confirming ? (
                            <span className="confirm">
                              <span className="small">Reverse this entry?</span>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                disabled={cancel.isPending}
                                onClick={() =>
                                  cancel.mutate(request.id, {
                                    onSettled: () => setConfirmId(null),
                                  })
                                }
                              >
                                Yes, cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn--quiet btn--sm"
                                onClick={() => setConfirmId(null)}
                              >
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              onClick={() => {
                                cancel.reset();
                                setConfirmId(request.id);
                              }}
                              aria-label={`Cancel request for ${range}`}
                            >
                              <Icon name="undo" size={16} />
                              Cancel
                            </button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

/** A running balance: a count of days, or "Unlimited" for a type with no allowance. */
function Balance({ value }: { value: number | null }) {
  if (value === null) return <>Unlimited</>;
  return (
    <>
      <span className="num">{value}</span> {value === 1 ? "day" : "days"}
    </>
  );
}

function LedgerTable({ lines }: { lines: BalanceLine[] }) {
  return (
    <div className="table-wrap table-wrap--bleed">
      <table className="ledger ledger--balance">
        <caption className="visually-hidden">Balance by leave type</caption>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col" className="r">
              Allowance
            </th>
            <th scope="col" className="r">
              Posted
            </th>
            <th scope="col" className="r">
              Pencilled
            </th>
            <th scope="col" className="r">
              Remaining
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const low =
              line.remaining !== null &&
              line.allowance !== null &&
              line.remaining <= Math.ceil(line.allowance * 0.15);
            return (
              <Fragment key={line.leaveTypeId}>
                <tr className="line-row">
                  <th scope="row">{line.leaveTypeName}</th>
                  <td className={`r${line.allowance === null ? " word" : " num"}`}>
                    {line.allowance ?? "No limit"}
                  </td>
                  <td className="r num">{line.used}</td>
                  <td className="r num">{line.pending}</td>
                  <td
                    className={`r remaining${line.remaining === null ? " word" : " num"}${low ? " is-low" : ""}`}
                  >
                    {line.remaining ?? "Unlimited"}
                  </td>
                </tr>
                <tr className="bar-row" aria-hidden="true">
                  <td colSpan={5}>
                    <Meter line={line} />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
