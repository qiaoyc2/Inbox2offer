"use client";

import { useActionState } from "react";
import {
  parseRawEmailAction,
  type ParseRawEmailState,
} from "@/app/actions/email-parsing";

const initialState: ParseRawEmailState = { status: "idle" };

export function ParseEmailButton({
  rawEmailId,
  alreadyParsed,
}: {
  rawEmailId: string;
  alreadyParsed: boolean;
}) {
  const [state, formAction, pending] = useActionState(parseRawEmailAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="rawEmailId" value={rawEmailId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {pending ? "Parsing…" : alreadyParsed ? "Reparse" : "Parse"}
      </button>
      <span
        aria-live="polite"
        className={`text-xs ${
          state.status === "error"
            ? "text-red-600 dark:text-red-400"
            : "text-green-700 dark:text-green-400"
        }`}
      >
        {state.status !== "idle" && state.message}
      </span>
    </form>
  );
}
