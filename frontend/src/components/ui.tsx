import type { ReactNode } from "react";
import type { RequestStatus } from "../api/types";
import { Icon, type IconName } from "./Icon";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * Pencilled (pending), posted in ink (approved), stamped (rejected), reversed (cancelled).
 * `landing` plays the one authored moment: the stamp coming down on the page.
 */
export function StatusStamp({ status, landing = false }: { status: RequestStatus; landing?: boolean }) {
  return <span className={`stamp stamp--${status}${landing ? " is-landing" : ""}`}>{STATUS_LABEL[status]}</span>;
}

export function PageHeader({
  title,
  running,
  actions,
}: {
  title: string;
  /** Running head: names the span you are looking at (a year, a month, a team). */
  running?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {running ? <p className="running">{running}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

const NOTE_ICON: Record<"error" | "warn" | "info", IconName> = {
  error: "alert",
  warn: "alert",
  info: "info",
};

export function Note({
  tone = "info",
  children,
  live = false,
}: {
  tone?: "error" | "warn" | "info";
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <div
      className={`note note--${tone}`}
      role={tone === "error" ? "alert" : live ? "status" : undefined}
    >
      <Icon name={NOTE_ICON[tone]} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="loading" role="status">
      <span className="loading-dot" aria-hidden="true" />
      {label}…
    </p>
  );
}

export function YearStepper({
  year,
  onChange,
}: {
  year: number;
  onChange: (year: number) => void;
}) {
  return (
    <div className="stepper" role="group" aria-label="Leave year">
      <button
        type="button"
        className="btn btn--quiet btn--icon"
        onClick={() => onChange(year - 1)}
        aria-label={`Show ${year - 1}`}
      >
        <Icon name="left" />
      </button>
      <span className="stepper-value num" aria-live="polite">
        {year}
      </span>
      <button
        type="button"
        className="btn btn--quiet btn--icon"
        onClick={() => onChange(year + 1)}
        aria-label={`Show ${year + 1}`}
      >
        <Icon name="right" />
      </button>
    </div>
  );
}
