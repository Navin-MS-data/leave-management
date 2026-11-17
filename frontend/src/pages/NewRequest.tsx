import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, errorMessage } from "../api/client";
import {
  useCreateRequest,
  useHolidays,
  useLeaveTypes,
  useMyBalance,
  usePreview,
  useSettings,
} from "../api/hooks";
import type { PreviewResult, Violation } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { Loading, Note, PageHeader } from "../components/ui";
import {
  addDays,
  dayOfMonth,
  eachDay,
  fmtDate,
  fmtRange,
  isWeekend,
  todayISO,
  weekdayShort,
  yearOf,
} from "../lib/dates";
import { plural } from "../lib/ledger";
import { useDebounced } from "../lib/useDebounced";
import { requestSchema, type RequestFormValues } from "./requestSchema";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();
  const types = useLeaveTypes();
  const settings = useSettings();
  const create = useCreateRequest();
  const [serverViolations, setServerViolations] = useState<Violation[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { leaveTypeId: "", startDate: "", endDate: "", reason: "" },
    mode: "onTouched",
  });

  const values = watch();
  // Once both dates are filled in, say at once if the range is backwards (and clear it when it is fixed),
  // whichever of the two fields was edited last. Without this the error only appears on Submit.
  useEffect(() => {
    if (ISO.test(values.startDate) && ISO.test(values.endDate)) void trigger("endDate");
  }, [values.startDate, values.endDate, trigger]);
  const datesOk =
    ISO.test(values.startDate) && ISO.test(values.endDate) && values.endDate >= values.startDate;
  const currentInput =
    values.leaveTypeId && datesOk
      ? {
          leaveTypeId: Number(values.leaveTypeId),
          startDate: values.startDate,
          endDate: values.endDate,
        }
      : null;
  const previewInput = useDebounced(currentInput);
  const waitingForTyping = JSON.stringify(currentInput) !== JSON.stringify(previewInput);
  const preview = usePreview(previewInput);
  const holidays = useHolidays(
    yearOf(values.startDate && ISO.test(values.startDate) ? values.startDate : today),
  );
  const balance = useMyBalance(yearOf(ISO.test(values.startDate) ? values.startDate : today));

  const earliest = settings.data ? addDays(today, settings.data.minNoticeDays) : today;
  const typeName = types.data?.find((t) => String(t.id) === values.leaveTypeId)?.name ?? "";
  const holidayNames = useMemo(
    () => new Map((holidays.data ?? []).map((h) => [h.date, h.name])),
    [holidays.data],
  );

  const checking =
    currentInput !== null && (waitingForTyping || preview.isFetching || preview.isPlaceholderData);
  const blocked = preview.data?.valid === false && !checking;
  const approver = user?.role === "manager" ? "an admin" : "your manager";

  const onSubmit = handleSubmit((form) => {
    setServerViolations([]);
    create.mutate(
      {
        leaveTypeId: Number(form.leaveTypeId),
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      },
      {
        onSuccess: (created) =>
          navigate("/", {
            replace: true,
            state: {
              freshId: created.id,
              flash: `Pencilled in ${plural(created.days, "day")} of ${typeName.toLowerCase()} leave, ${fmtRange(created.startDate, created.endDate)}. Waiting for ${approver} to post it.`,
            },
          }),
        onError: (error) => {
          if (error instanceof ApiError && error.violations.length > 0)
            setServerViolations(error.violations);
        },
      },
    );
  });

  return (
    <>
      <PageHeader
        title="New request"
        running={
          settings.data ? `Notice needed: ${plural(settings.data.minNoticeDays, "day")}` : undefined
        }
        actions={
          <Link to="/" className="btn btn--quiet">
            Back to statement
          </Link>
        }
      />

      <div className="request-layout">
        <form onSubmit={onSubmit} className="panel stack" noValidate aria-label="Leave request">
          {create.isError && serverViolations.length === 0 ? (
            <Note tone="error">{errorMessage(create.error)}</Note>
          ) : null}
          {serverViolations.length > 0 ? (
            <Note tone="error">
              <strong>The server did not accept this request.</strong>
              <ul className="plain-list">
                {serverViolations.map((v) => (
                  <li key={v.code}>{v.message}</li>
                ))}
              </ul>
            </Note>
          ) : null}

          <div className="field">
            <label htmlFor="leaveTypeId">Leave type</label>
            <select
              id="leaveTypeId"
              {...register("leaveTypeId")}
              aria-invalid={!!errors.leaveTypeId}
              aria-describedby="leaveTypeId-err"
            >
              <option value="">Choose a type</option>
              {types.data?.map((t) => {
                const line = balance.data?.balances.find((b) => b.leaveTypeId === t.id);
                const left = line?.remaining;
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {left === null ? " · unlimited" : left !== undefined ? ` · ${left} left` : ""}
                  </option>
                );
              })}
            </select>
            <FieldError id="leaveTypeId-err" message={errors.leaveTypeId?.message} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="startDate">First day</label>
              <input
                id="startDate"
                type="date"
                min={earliest}
                {...register("startDate")}
                aria-invalid={!!errors.startDate}
                aria-describedby="startDate-hint startDate-err"
              />
              <p id="startDate-hint" className="hint">
                Earliest: <span className="num">{fmtDate(earliest, true)}</span>
              </p>
              <FieldError id="startDate-err" message={errors.startDate?.message} />
            </div>
            <div className="field">
              <label htmlFor="endDate">Last day</label>
              <input
                id="endDate"
                type="date"
                min={ISO.test(values.startDate) ? values.startDate : earliest}
                {...register("endDate")}
                aria-invalid={!!errors.endDate}
                aria-describedby="endDate-err"
              />
              <FieldError id="endDate-err" message={errors.endDate?.message} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="reason">Reason</label>
            <textarea
              id="reason"
              rows={3}
              maxLength={500}
              {...register("reason")}
              aria-invalid={!!errors.reason}
              aria-describedby="reason-err"
            />
            <FieldError id="reason-err" message={errors.reason?.message} />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={create.isPending || blocked || checking}
            >
              {create.isPending ? "Submitting…" : "Submit request"}
            </button>
            <Link to="/" className="btn btn--quiet">
              Cancel
            </Link>
            {blocked ? (
              <span className="small muted">Fix the items marked in the pencilled entry to continue.</span>
            ) : null}
          </div>
        </form>

        <aside className="panel entry-preview" aria-labelledby="entry-title" aria-live="polite">
          <h2 id="entry-title">Pencilled entry</h2>
          <EntryPreview
            typeName={typeName}
            start={values.startDate}
            end={values.endDate}
            datesOk={datesOk}
            hasType={!!values.leaveTypeId}
            checking={checking}
            result={preview.data}
            error={preview.isError ? errorMessage(preview.error) : null}
            holidayNames={holidayNames}
          />
        </aside>
      </div>
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="field-error" role={message ? "alert" : undefined}>
      {message}
    </p>
  );
}

interface PreviewProps {
  typeName: string;
  start: string;
  end: string;
  datesOk: boolean;
  hasType: boolean;
  checking: boolean;
  result?: PreviewResult;
  error: string | null;
  holidayNames: Map<string, string>;
}

function EntryPreview({
  typeName,
  start,
  end,
  datesOk,
  hasType,
  checking,
  result,
  error,
  holidayNames,
}: PreviewProps) {
  if (!hasType || !datesOk) {
    return (
      <p className="muted">
        Choose a leave type and dates. The day count, your balance after the request and any rule it
        would break appear here before you submit.
      </p>
    );
  }
  if (error) return <Note tone="error">{error}</Note>;
  if (!result) return <Loading label="Checking the rules" />;

  const counted = new Set(result.workingDays);
  const blockedDays = new Set(result.violations.flatMap((v) => v.dates ?? []));
  const range = eachDay(start, end);
  const skipped = range.filter((d) => !counted.has(d));
  const showStrip = range.length <= 62;

  return (
    <div className={`entry${checking ? " is-checking" : ""}`}>
      <p className="entry-line">
        <span>{typeName}</span>
        <span className="num">{fmtRange(start, end)}</span>
      </p>

      <p className="entry-days">
        <span className="num entry-count">{result.days}</span>
        <span>working {result.days === 1 ? "day" : "days"} counted</span>
      </p>

      {result.allowance === null ? (
        <p className="entry-after">No limit on this leave type.</p>
      ) : (
        <p className="entry-after">
          Balance after:{" "}
          <strong className={`num${(result.remainingAfter ?? 0) < 0 ? " is-over" : ""}`}>
            {result.remainingAfter}
          </strong>{" "}
          of <span className="num">{result.allowance}</span> days
        </p>
      )}

      {showStrip ? (
        <div
          className="daystrip"
          role="img"
          aria-label={`${result.days} of ${range.length} calendar days count as leave`}
        >
          {range.map((d) => {
            const kind = counted.has(d) ? "counted" : isWeekend(d) ? "weekend" : "holiday";
            return (
              <span
                key={d}
                className={`day day--${kind}${blockedDays.has(d) ? " day--blocked" : ""}`}
                title={`${fmtDate(d)}${holidayNames.get(d) ? ` · ${holidayNames.get(d)}` : ""}${kind === "counted" ? "" : " · not counted"}`}
              >
                <span className="day-wd">{weekdayShort(d).slice(0, 2)}</span>
                <span className="day-n num">{dayOfMonth(d)}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <p className="hint">
          Not counted:{" "}
          {skipped
            .slice(0, 6)
            .map((d) => `${fmtDate(d)}${holidayNames.get(d) ? ` (${holidayNames.get(d)})` : ""}`)
            .join(", ")}
          {skipped.length > 6 ? ` and ${skipped.length - 6} more` : ""}
        </p>
      ) : null}

      {result.violations.length > 0 ? (
        <ul className="violations">
          {result.violations.map((v) => (
            <li key={v.code}>
              <Icon name="alert" size={16} />
              <span>{v.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="entry-ok">
          <Icon name="check" size={16} />
          {checking ? "Checking again…" : "Every rule is met. Ready to submit."}
        </p>
      )}
    </div>
  );
}
