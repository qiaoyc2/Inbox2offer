"use client";

import { useActionState, useState } from "react";
import {
  createRawEmailAction,
  type CreateRawEmailState,
} from "@/app/actions/raw-emails";
import type { CreateRawEmailField } from "@/lib/validation/raw-email";

const initialState: CreateRawEmailState = { status: "idle" };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// datetime-local has no timezone, so it is converted to an absolute ISO timestamp in the browser.
function toIsoTimestamp(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function RawEmailForm() {
  const [state, formAction, pending] = useActionState(
    createRawEmailAction,
    initialState,
  );
  const [receivedAtLocal, setReceivedAtLocal] = useState("");

  const values = state.status === "error" ? state.values : undefined;
  const fieldError = (field: CreateRawEmailField) =>
    state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sender" name="sender" error={fieldError("sender")}>
          <input
            id="sender"
            name="sender"
            required
            placeholder="Recruiting <jobs@example.com>"
            defaultValue={values?.sender}
            className={inputClass}
          />
        </Field>
        <Field label="Recipient" name="recipient" error={fieldError("recipient")}>
          <input
            id="recipient"
            name="recipient"
            required
            placeholder="me@example.com"
            defaultValue={values?.recipient}
            className={inputClass}
          />
        </Field>
        <Field label="Subject" name="subject" error={fieldError("subject")}>
          <input
            id="subject"
            name="subject"
            defaultValue={values?.subject}
            className={inputClass}
          />
        </Field>
        <Field
          label="Received at (your local time)"
          name="receivedAt"
          htmlFor="receivedAtLocal"
          error={fieldError("receivedAt")}
        >
          <div className="flex gap-2">
            <input
              id="receivedAtLocal"
              type="datetime-local"
              step={1}
              required
              value={receivedAtLocal}
              onChange={(event) => setReceivedAtLocal(event.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setReceivedAtLocal(toLocalInputValue(new Date()))}
              className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Now
            </button>
          </div>
          <input type="hidden" name="receivedAt" value={toIsoTimestamp(receivedAtLocal)} />
        </Field>
        <Field
          label="Provider message ID (optional)"
          name="providerMessageId"
          error={fieldError("providerMessageId")}
        >
          <input
            id="providerMessageId"
            name="providerMessageId"
            placeholder="Generated as manual-<uuid> if blank"
            defaultValue={values?.providerMessageId}
            className={inputClass}
          />
        </Field>
        <Field label="Thread ID (optional)" name="threadId" error={fieldError("threadId")}>
          <input
            id="threadId"
            name="threadId"
            defaultValue={values?.threadId}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Raw body" name="body" error={fieldError("body")}>
        <textarea
          id="body"
          name="body"
          rows={10}
          required
          spellCheck={false}
          defaultValue={values?.body}
          className={`${inputClass} font-mono`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Storing…" : "Store raw email"}
        </button>
        <div
          aria-live="polite"
          className={`text-sm ${
            state.status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-green-700 dark:text-green-400"
          }`}
        >
          {state.status !== "idle" && <p>{state.message}</p>}
          {state.status === "success" && (
            <p className="font-mono text-xs">
              providerMessageId: {state.stored.providerMessageId} · body:{" "}
              {state.stored.bodyLength.toLocaleString("en-US")} chars
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  htmlFor,
  error,
  children,
}: {
  label: string;
  name: CreateRawEmailField;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor ?? name}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
