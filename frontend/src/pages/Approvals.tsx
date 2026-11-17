import { useMemo, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import { useCalendar, useDecideRequest, useInbox, useUsers } from "../api/hooks";
import type { LeaveRequest, RequestStatus, Violation } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { Empty, Loading, Note, PageHeader, StatusStamp } from "../components/ui";
import { eachDay, fmtDate, fmtRange, isWeekend } from "../lib/dates";
import { plural } from "../lib/ledger";

type Filter = RequestStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function Approvals() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // The last decision, kept on screen as a posting line: the pencilled request becomes ink (or is stamped rejected).
  const [posted, setPosted] = useState<{
    id: number;
    who: string;
    range: string;
    days: number;
    outcome: "approve" | "reject";
  } | null>(null);
  // The decision lives here, not in the detail panel: that panel is re-created for every request, and a
  // mutation owned by a panel that has gone never reports back (so no posting line, no advance).
  const decide = useDecideRequest();
  const inbox = useInbox(filter);
  const list = inbox.data ?? [];
  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  const running = inbox.data
    ? filter === "pending"
      ? `${plural(list.length, "request")} waiting`
      : `${plural(list.length, "request")} shown`
    : undefined;

  return (
    <>
      <PageHeader
        title="Approvals"
        running={running}
        actions={
          <div className="field field--inline">
            <label htmlFor="status-filter">Show</label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as Filter);
                setSelectedId(null);
                setPosted(null);
                decide.reset();
              }}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {posted ? (
        <p className="posting" role="status" key={posted.id}>
          <StatusStamp status={posted.outcome === "approve" ? "approved" : "rejected"} landing />
          <span>
            {posted.who}, <span className="num">{posted.range}</span>, {plural(posted.days, "day")}.{" "}
            {posted.outcome === "approve" ? "Posted in ink." : "Stamped rejected; the days go back."}
          </span>
        </p>
      ) : null}

      {inbox.isPending ? <Loading label="Loading requests" /> : null}
      {inbox.isError ? <Note tone="error">{errorMessage(inbox.error)}</Note> : null}

      {inbox.data && list.length === 0 ? (
        <Empty
          title={
            filter === "pending"
              ? "Nothing is waiting for a decision"
              : "No requests match this filter"
          }
        >
          {filter === "pending"
            ? "New requests from your team appear here as soon as they are made."
            : "Try another status."}
        </Empty>
      ) : null}

      {list.length > 0 && selected ? (
        <div className="approvals">
          <nav aria-label="Requests" className="panel panel--flush request-list">
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`request-row${r.id === selected.id ? " is-selected" : ""}`}
                    aria-current={r.id === selected.id ? "true" : undefined}
                    onClick={() => {
                      decide.reset();
                      setSelectedId(r.id);
                    }}
                  >
                    <span className="request-row-top">
                      <strong>{r.user?.name}</strong>
                      <StatusStamp status={r.status} />
                    </span>
                    <span className="num small">{fmtRange(r.startDate, r.endDate)}</span>
                    <span className="small muted">
                      {r.leaveType?.name} · {plural(r.days, "day")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <Detail
            key={selected.id}
            request={selected}
            decide={decide}
            onDecided={(outcome) => {
              setPosted({
                id: selected.id,
                who: selected.user?.name ?? "Request",
                range: fmtRange(selected.startDate, selected.endDate),
                days: selected.days,
                outcome,
              });
              const index = list.findIndex((r) => r.id === selected.id);
              const next = list[index + 1] ?? list[index - 1] ?? null;
              setSelectedId(filter === "pending" ? (next?.id ?? null) : selected.id);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function Detail({
  request,
  decide,
  onDecided,
}: {
  request: LeaveRequest;
  decide: ReturnType<typeof useDecideRequest>;
  onDecided: (outcome: "approve" | "reject") => void;
}) {
  const [note, setNote] = useState("");
  const working = decide.isPending ? decide.variables?.outcome : undefined;
  const violations: Violation[] = decide.error instanceof ApiError ? decide.error.violations : [];
  const pending = request.status === "pending";

  function act(outcome: "approve" | "reject") {
    decide.mutate(
      { id: request.id, outcome, note: note.trim() || undefined },
      { onSuccess: () => onDecided(outcome) },
    );
  }

  return (
    <section className="panel detail" aria-labelledby="detail-title">
      <div className="detail-head">
        <div>
          <h2 id="detail-title">{request.user?.name}</h2>
          <p className="muted small">
            {request.user?.role === "manager" ? "Manager" : "Employee"} · {request.user?.email}
          </p>
        </div>
        <StatusStamp status={request.status} />
      </div>

      <dl className="facts">
        <div>
          <dt>Dates</dt>
          <dd className="num">{fmtRange(request.startDate, request.endDate)}</dd>
        </div>
        <div>
          <dt>Counted</dt>
          <dd>
            <span className="num">{request.days}</span> working{" "}
            {request.days === 1 ? "day" : "days"}
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{request.leaveType?.name}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{request.reason}</dd>
        </div>
        {request.decisionNote ? (
          <div>
            <dt>Note</dt>
            <dd>{request.decisionNote}</dd>
          </div>
        ) : null}
      </dl>

      {pending ? <CoverageImpact request={request} /> : null}

      {decide.isError ? (
        <Note tone="error">
          {violations.length > 0 ? (
            <>
              <strong>This cannot be approved right now.</strong>
              <ul className="plain-list">
                {violations.map((v) => (
                  <li key={v.code}>{v.message}</li>
                ))}
              </ul>
            </>
          ) : (
            errorMessage(decide.error)
          )}
        </Note>
      ) : null}

      {pending ? (
        <div className="decision">
          <div className="field">
            <label htmlFor="note">Note to {request.user?.name.split(" ")[0]} (optional)</label>
            <textarea
              id="note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={decide.isPending}
              onClick={() => act("approve")}
            >
              <Icon name="check" />
              {working === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={decide.isPending}
              onClick={() => act("reject")}
            >
              <Icon name="x" />
              {working === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted small">
          This request has already been {request.status}. Only pending requests can be decided.
        </p>
      )}
    </section>
  );
}

/** Shows, day by day, how many teammates are already off and what approving would do to the limit. */
function CoverageImpact({ request }: { request: LeaveRequest }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const calendar = useCalendar(request.startDate, request.endDate);
  const users = useUsers(isAdmin);
  const data = calendar.data;

  const rows = useMemo(() => {
    if (!data) return [];
    // Admins see the whole company in the calendar, so narrow it to the owner's team.
    const teamIds = isAdmin
      ? new Set([
          request.userId,
          ...(users.data ?? []).filter((u) => u.managerId === request.userId).map((u) => u.id),
        ])
      : new Set(data.members.map((m) => m.id));
    const holidays = new Set(data.holidays.map((h) => h.date));
    return eachDay(request.startDate, request.endDate)
      .filter((d) => !isWeekend(d) && !holidays.has(d))
      .map((day) => {
        const others = new Set(
          data.entries
            .filter(
              (e) =>
                e.userId !== request.userId &&
                teamIds.has(e.userId) &&
                e.startDate <= day &&
                day <= e.endDate,
            )
            .map((e) => e.userId),
        ).size;
        return { day, others, after: others + 1 };
      });
  }, [data, users.data, isAdmin, request]);

  if (calendar.isPending || (isAdmin && users.isPending))
    return <Loading label="Checking team coverage" />;
  if (calendar.isError || !data)
    return (
      <Note tone="warn">
        Team coverage could not be loaded. The server still checks it when you approve.
      </Note>
    );

  const max = data.maxTeamOffPerDay;
  const shown = rows.slice(0, 8);
  const worst = rows.reduce((m, r) => Math.max(m, r.after), 0);

  return (
    <div className="coverage">
      <h3>Coverage if approved</h3>
      <p className="muted small">
        Limit: <span className="num">{max}</span> off per working day, pending requests included.
        {worst > max ? " Approving would go over the limit on some days." : ""}
      </p>
      <ul className="coverage-list">
        {shown.map((r) => {
          const state = r.after > max ? "over" : r.after === max ? "full" : "ok";
          return (
            <li key={r.day} className={`coverage-row coverage-row--${state}`}>
              <span className="num">{fmtDate(r.day)}</span>
              <span className="coverage-pips" aria-hidden="true">
                {Array.from({ length: Math.max(max, r.after) }, (_, i) => (
                  <i
                    key={i}
                    className={
                      i < r.others ? "pip pip--taken" : i < r.after ? "pip pip--this" : "pip"
                    }
                  />
                ))}
              </span>
              <span className="small">
                <span className="num">{r.others}</span> already off,{" "}
                <span className="num">
                  {r.after}/{max}
                </span>{" "}
                with this
                {state === "over" ? " · over the limit" : state === "full" ? " · at the limit" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > shown.length ? (
        <p className="muted small">and {rows.length - shown.length} more working days</p>
      ) : null}
    </div>
  );
}
