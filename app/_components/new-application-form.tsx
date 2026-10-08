"use client";

import { useActionState } from "react";
import {
  createApplicationAction,
  type CreateApplicationState,
} from "@/app/actions/applications";
import type { CreateApplicationField } from "@/lib/validation/application";

const initialState: CreateApplicationState = { status: "idle" };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function NewApplicationForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(
    createApplicationAction,
    initialState,
  );

  const values = state.status === "error" ? state.values : undefined;
  const fieldError = (field: CreateApplicationField) =>
    state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" name="company" error={fieldError("company")}>
          <input
            id="company"
            name="company"
            required
            maxLength={200}
            defaultValue={values?.company}
            className={inputClass}
          />
        </Field>
        <Field label="Position" name="position" error={fieldError("position")}>
          <input
            id="position"
            name="position"
            required
            maxLength={200}
            defaultValue={values?.position}
            className={inputClass}
          />
        </Field>
        <Field label="Location" name="location" error={fieldError("location")}>
          <input
            id="location"
            name="location"
            maxLength={200}
            defaultValue={values?.location}
            className={inputClass}
          />
        </Field>
        <Field
          label="Application date"
          name="applicationDate"
          error={fieldError("applicationDate")}
        >
          <input
            id="applicationDate"
            name="applicationDate"
            type="date"
            required
            defaultValue={values?.applicationDate ?? today}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Notes" name="notes" error={fieldError("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={values?.notes}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Add application"}
        </button>
        <p
          aria-live="polite"
          className={`text-sm ${
            state.status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-green-700 dark:text-green-400"
          }`}
        >
          {state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: CreateApplicationField;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
