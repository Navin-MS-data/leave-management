import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useHolidays, useLeaveTypes, useSettings, useUsers } from "../api/hooks";
import type { LeaveType, Role, Settings, User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { Empty, Loading, Note, PageHeader, YearStepper } from "../components/ui";
import { fmtDate, todayISO, yearOf } from "../lib/dates";

const TABS = [
  { to: "rules", label: "Rules" },
  { to: "leave-types", label: "Leave types" },
  { to: "holidays", label: "Public holidays" },
  { to: "people", label: "People" },
];

export function Admin() {
  return (
    <>
      <PageHeader title="Rules & setup" running="Changes apply to new requests straight away" />
      <nav aria-label="Setup sections" className="subnav">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `subnav-link${isActive ? " is-active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="rules" replace />} />
        <Route path="rules" element={<Rules />} />
        <Route path="leave-types" element={<LeaveTypes />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="people" element={<People />} />
        <Route path="*" element={<Navigate to="rules" replace />} />
      </Routes>
    </>
  );
}

/* ----------------------------------------------------------------- rules */

function Rules() {
  const settings = useSettings();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [maxOff, setMaxOff] = useState("");

  useEffect(() => {
    if (settings.data) {
      setNotice(String(settings.data.minNoticeDays));
      setMaxOff(String(settings.data.maxTeamOffPerDay));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: Settings) => api.put<Settings>("/settings", body),
    onSuccess: () =>
      Promise.all(
        ["settings", "calendar", "preview"].map((k) => client.invalidateQueries({ queryKey: [k] })),
      ),
  });

  const noticeN = Number(notice);
  const maxN = Number(maxOff);
  const noticeBad = notice === "" || !Number.isInteger(noticeN) || noticeN < 0 || noticeN > 365;
  const maxBad = maxOff === "" || !Number.isInteger(maxN) || maxN < 1 || maxN > 1000;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (noticeBad || maxBad) return;
    save.mutate({ minNoticeDays: noticeN, maxTeamOffPerDay: maxN });
  }

  if (settings.isPending) return <Loading />;
  if (settings.isError) return <Note tone="error">{errorMessage(settings.error)}</Note>;

  return (
    <form onSubmit={submit} className="panel stack narrow" noValidate>
      <h2>Request rules</h2>
      <p className="muted">
        These two values drive the checks on every request. Allowances are set per leave type.
      </p>
      {save.isError ? <Note tone="error">{errorMessage(save.error)}</Note> : null}
      {save.isSuccess ? (
        <Note tone="info" live>
          Saved. New requests use these values now, and approvals re-check against them.
        </Note>
      ) : null}

      <div className="field">
        <label htmlFor="notice">Minimum notice (days)</label>
        <input
          id="notice"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={notice}
          onChange={(e) => {
            save.reset();
            setNotice(e.target.value);
          }}
          aria-invalid={noticeBad}
          aria-describedby="notice-hint"
        />
        <p id="notice-hint" className={`hint${noticeBad ? " is-error" : ""}`}>
          A request must start at least this many days from today. Whole number from 0 to 365.
        </p>
      </div>
      <div className="field">
        <label htmlFor="maxoff">Most people off on the same day (per team)</label>
        <input
          id="maxoff"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          value={maxOff}
          onChange={(e) => {
            save.reset();
            setMaxOff(e.target.value);
          }}
          aria-invalid={maxBad}
          aria-describedby="maxoff-hint"
        />
        <p id="maxoff-hint" className={`hint${maxBad ? " is-error" : ""}`}>
          Counts the manager and pending requests. Whole number from 1.
        </p>
      </div>
      <div className="form-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={save.isPending || noticeBad || maxBad}
        >
          {save.isPending ? "Saving…" : "Save rules"}
        </button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------- leave types */

function LeaveTypes() {
  const types = useLeaveTypes();
  const client = useQueryClient();
  const refresh = () =>
    Promise.all(
      ["leave-types", "balances", "preview"].map((k) =>
        client.invalidateQueries({ queryKey: [k] }),
      ),
    );

  const create = useMutation({
    mutationFn: (body: { name: string; yearlyAllowance: number | null; isPaid: boolean }) =>
      api.post<LeaveType>("/leave-types", body),
    onSuccess: refresh,
  });
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [paid, setPaid] = useState(true);
  const allowanceBad =
    !unlimited &&
    (allowance === "" ||
      !Number.isInteger(Number(allowance)) ||
      Number(allowance) < 0 ||
      Number(allowance) > 366);

  const [tried, setTried] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!name.trim() || allowanceBad) return;
    create.mutate(
      { name: name.trim(), yearlyAllowance: unlimited ? null : Number(allowance), isPaid: paid },
      {
        onSuccess: () => {
          setName("");
          setAllowance("");
          setUnlimited(false);
          setPaid(true);
          setTried(false);
        },
      },
    );
  }

  return (
    <div className="stack">
      <div className="panel panel--flush">
        <div className="panel-head">
          <h2>Leave types</h2>
          <p className="muted small">
            The yearly allowance is the most days one person can have pending or approved in a
            calendar year.
          </p>
        </div>
        {types.isPending ? <Loading /> : null}
        {types.isError ? <Note tone="error">{errorMessage(types.error)}</Note> : null}
        {types.data ? (
          <div className="table-wrap">
            <table className="ledger ledger--stack ledger--center">
              <caption className="visually-hidden">Leave types</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Yearly allowance</th>
                  <th scope="col">Paid</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {types.data.map((t) => (
                  <TypeRow key={t.id} type={t} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="panel stack narrow" noValidate>
        <h2>Add a leave type</h2>
        {create.isError ? <Note tone="error">{errorMessage(create.error)}</Note> : null}
        {tried && (!name.trim() || allowanceBad) ? (
          <Note tone="error">
            Give the leave type a name
            {unlimited ? "" : " and a yearly allowance of 0 to 366 days (or tick Unlimited)"}.
          </Note>
        ) : null}
        <div className="field">
          <label htmlFor="lt-name">Name</label>
          <input
            id="lt-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="lt-allowance">Yearly allowance (days)</label>
            <input
              id="lt-allowance"
              type="number"
              min={0}
              max={366}
              value={allowance}
              disabled={unlimited}
              onChange={(e) => setAllowance(e.target.value)}
            />
          </div>
          <div className="checks">
            <label className="check">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
              />{" "}
              Unlimited
            </label>
            <label className="check">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />{" "}
              Paid
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={create.isPending}
          >
            <Icon name="plus" /> Add leave type
          </button>
        </div>
      </form>
    </div>
  );
}

function TypeRow({ type, onChanged }: { type: LeaveType; onChanged: () => void }) {
  const [allowance, setAllowance] = useState(
    type.yearlyAllowance === null ? "" : String(type.yearlyAllowance),
  );
  const [unlimited, setUnlimited] = useState(type.yearlyAllowance === null);
  const [paid, setPaid] = useState(type.isPaid);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.patch<LeaveType>(`/leave-types/${type.id}`, {
        yearlyAllowance: unlimited ? null : Number(allowance),
        isPaid: paid,
      }),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/leave-types/${type.id}`),
    onSuccess: onChanged,
  });

  const bad =
    !unlimited &&
    (allowance === "" ||
      !Number.isInteger(Number(allowance)) ||
      Number(allowance) < 0 ||
      Number(allowance) > 366);
  const dirty =
    unlimited !== (type.yearlyAllowance === null) ||
    (!unlimited && Number(allowance) !== type.yearlyAllowance) ||
    paid !== type.isPaid;

  return (
    <>
      <tr>
        <th scope="row">{type.name}</th>
        <td data-label="Yearly allowance">
          <span className="inline-edit">
            <input
              aria-label={`Yearly allowance for ${type.name}`}
              className="num"
              type="number"
              min={0}
              max={366}
              value={allowance}
              disabled={unlimited}
              onChange={(e) => {
                save.reset();
                setAllowance(e.target.value);
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => {
                  save.reset();
                  setUnlimited(e.target.checked);
                }}
              />{" "}
              Unlimited
            </label>
          </span>
        </td>
        <td data-label="Paid">
          <label className="check">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => {
                save.reset();
                setPaid(e.target.checked);
              }}
            />{" "}
            Paid
          </label>
        </td>
        <td className="r">
          <span className="row-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!dirty || bad || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(undefined, { onSettled: () => setConfirmDelete(false) })
                  }
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => {
                  remove.reset();
                  setConfirmDelete(true);
                }}
                aria-label={`Delete ${type.name}`}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </span>
        </td>
      </tr>
      {save.isError || remove.isError || save.isSuccess ? (
        <tr className="row-message">
          <td colSpan={4}>
            {save.isError ? <Note tone="error">{errorMessage(save.error)}</Note> : null}
            {remove.isError ? <Note tone="error">{errorMessage(remove.error)}</Note> : null}
            {save.isSuccess && !dirty ? (
              <Note tone="info" live>
                Saved. Balances now use {unlimited ? "no limit" : `${allowance} days`} for{" "}
                {type.name}.
              </Note>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- holidays */

function Holidays() {
  const [year, setYear] = useState(yearOf(todayISO()));
  const holidays = useHolidays(year);
  const client = useQueryClient();
  const refresh = () =>
    Promise.all(
      ["holidays", "calendar", "preview"].map((k) => client.invalidateQueries({ queryKey: [k] })),
    );
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);

  const add = useMutation({
    mutationFn: () => api.post("/holidays", { date, name: name.trim() }),
    onSuccess: () => {
      setDate("");
      setName("");
      setTried(false);
      return refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/holidays/${id}`),
    onSuccess: refresh,
  });

  return (
    <div className="stack">
      <div className="panel panel--flush">
        <div className="panel-head panel-head--row">
          <div>
            <h2>Public holidays</h2>
            <p className="muted small">Weekends and these days never count as leave days.</p>
          </div>
          <YearStepper year={year} onChange={setYear} />
        </div>
        {holidays.isPending ? <Loading /> : null}
        {holidays.isError ? <Note tone="error">{errorMessage(holidays.error)}</Note> : null}
        {remove.isError ? <Note tone="error">{errorMessage(remove.error)}</Note> : null}
        {holidays.data && holidays.data.length === 0 ? (
          <Empty title={`No holidays set for ${year}`}>Add one below.</Empty>
        ) : null}
        {holidays.data && holidays.data.length > 0 ? (
          <table className="ledger ledger--center ledger--holidays">
            <caption className="visually-hidden">Public holidays {year}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Name</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {holidays.data.map((h) => (
                <tr key={h.id}>
                  <td className="num">{fmtDate(h.date, true)}</td>
                  <td>{h.name}</td>
                  <td className="r">
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(h.id)}
                      aria-label={`Remove ${h.name}`}
                    >
                      <Icon name="trash" size={16} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (date && name.trim()) add.mutate();
        }}
        className="panel stack narrow"
        noValidate
      >
        <h2>Add a holiday</h2>
        {add.isError ? <Note tone="error">{errorMessage(add.error)}</Note> : null}
        {tried && (!date || !name.trim()) ? (
          <Note tone="error">Choose a date and give the holiday a name.</Note>
        ) : null}
        <div className="field-row">
          <div className="field">
            <label htmlFor="h-date">Date</label>
            <input id="h-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="h-name">Name</label>
            <input
              id="h-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={add.isPending}
          >
            <Icon name="plus" /> Add holiday
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- people */

const ROLES: Role[] = ["employee", "manager", "admin"];

function People() {
  const { user: me } = useAuth();
  const users = useUsers();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["users"] });
  const managers = (users.data ?? []).filter((u) => u.role === "manager" && u.active);

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Partial<Pick<User, "role" | "managerId" | "active">>;
    }) => api.patch<User>(`/users/${id}`, body),
    onSuccess: refresh,
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee" as Role,
    managerId: "",
  });
  const create = useMutation({
    mutationFn: () =>
      api.post<User>("/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        managerId: form.role === "employee" ? Number(form.managerId) : null,
      }),
    onSuccess: () => {
      setForm({ name: "", email: "", password: "", role: "employee", managerId: "" });
      setTried(false);
      return refresh();
    },
  });
  const formBad =
    !form.name.trim() ||
    !form.email.includes("@") ||
    form.password.length < 8 ||
    (form.role === "employee" && !form.managerId);
  const [tried, setTried] = useState(false);

  return (
    <div className="stack">
      <div className="panel panel--flush">
        <div className="panel-head">
          <h2>People</h2>
          <p className="muted small">
            Employees report to a manager. Managers' requests are decided by an admin. Deactivating
            someone signs them out at once.
          </p>
        </div>
        {users.isPending ? <Loading /> : null}
        {users.isError ? <Note tone="error">{errorMessage(users.error)}</Note> : null}
        {update.isError ? <Note tone="error">{errorMessage(update.error)}</Note> : null}
        {users.data ? (
          <div className="table-wrap">
            <table className="ledger ledger--stack ledger--center">
              <caption className="visually-hidden">People</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className={u.active ? undefined : "is-reversed"}>
                      <th scope="row">
                        {u.name}
                        <span className="sub">{u.email}</span>
                      </th>
                      <td data-label="Role">
                        <select
                          aria-label={`Role for ${u.name}`}
                          value={u.role}
                          disabled={self || update.isPending}
                          onChange={(e) => {
                            const role = e.target.value as Role;
                            update.mutate({
                              id: u.id,
                              body: {
                                role,
                                managerId:
                                  role === "employee"
                                    ? (u.managerId ?? managers[0]?.id ?? null)
                                    : null,
                              },
                            });
                          }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Manager">
                        {u.role === "employee" ? (
                          <select
                            aria-label={`Manager for ${u.name}`}
                            value={u.managerId ?? ""}
                            disabled={update.isPending}
                            onChange={(e) =>
                              update.mutate({
                                id: u.id,
                                body: { managerId: Number(e.target.value) },
                              })
                            }
                          >
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className="status-cell">
                          <span className={`status-word${u.active ? "" : " is-off"}`}>
                            {u.active ? "Active" : "Inactive"}
                          </span>
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            disabled={self || update.isPending}
                            onClick={() => update.mutate({ id: u.id, body: { active: !u.active } })}
                            aria-label={`${u.active ? "Deactivate" : "Reactivate"} ${u.name}`}
                          >
                            {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!formBad) create.mutate();
        }}
        className="panel stack narrow"
        noValidate
      >
        <h2>Add a person</h2>
        {create.isError ? <Note tone="error">{errorMessage(create.error)}</Note> : null}
        {tried && formBad ? (
          <Note tone="error">
            Fill in a name, a work email, a temporary password of at least 8 characters
            {form.role === "employee" ? ", and who they report to" : ""}.
          </Note>
        ) : null}
        <div className="field-row">
          <div className="field">
            <label htmlFor="p-name">Full name</label>
            <input
              id="p-name"
              value={form.name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="p-email">Work email</label>
            <input
              id="p-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="p-pass">Temporary password</label>
          <input
            id="p-pass"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            aria-describedby="p-pass-hint"
          />
          <p id="p-pass-hint" className="hint">
            At least 8 characters.
          </p>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="p-role">Role</label>
            <select
              id="p-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {form.role === "employee" ? (
            <div className="field">
              <label htmlFor="p-manager">Reports to</label>
              <select
                id="p-manager"
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              >
                <option value="">Choose a manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={create.isPending}>
            <Icon name="plus" /> Add person
          </button>
        </div>
      </form>
    </div>
  );
}
