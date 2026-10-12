import Link from "next/link";
import { connection } from "next/server";
import { ParseEmailButton } from "@/app/_components/parse-email-button";
import { RawEmailForm } from "@/app/_components/raw-email-form";
import type { EmailParseDTO } from "@/lib/dto/email-parse";
import {
  countRawEmailsByDisposition,
  listRecentRawEmailsWithParse,
} from "@/lib/services/email-parsing-service";
import { countRawEmails } from "@/lib/services/raw-email-service";
import {
  dispositionFilterSchema,
  type DispositionFilter,
} from "@/lib/validation/email-parsing";

const RECENT_LIMIT = 20;

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

const FILTER_LABELS: Record<DispositionFilter, string> = {
  JOB_RELATED: "Job related",
  NEEDS_REVIEW: "Needs review",
  IGNORED: "Ignored",
  UNPARSED: "Not parsed",
};

const DISPOSITION_BADGE: Record<EmailParseDTO["disposition"], string> = {
  JOB_RELATED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  IGNORED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const CLASSIFICATION_LABELS: Record<EmailParseDTO["classification"], string> = {
  APPLICATION_CONFIRMATION: "Application confirmation",
  ASSESSMENT: "Assessment",
  RECRUITER_SCREEN: "Recruiter screen",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final interview",
  APPLICATION_UPDATE: "Application update",
  ADDITIONAL_INFORMATION_REQUEST: "Follow-up (information request)",
  REJECTION: "Rejection",
  OFFER: "Offer",
  UNRELATED: "Other / unrelated",
  UNKNOWN: "Unknown",
};

export default async function RawEmailsDevPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const filter = dispositionFilterSchema.parse((await searchParams).disposition);
  const [items, total, counts] = await Promise.all([
    listRecentRawEmailsWithParse(RECENT_LIMIT, filter),
    countRawEmails(),
    countRawEmailsByDisposition(),
  ]);
  const shown = filter ? counts[filter] : total;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12 font-sans">
      <header>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Raw email ingestion
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Development tool. Emails are stored exactly as submitted. Parsing stores a
          classification alongside each email without changing it or linking it to
          applications. {total} stored.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Submit a test email
        </h2>
        <RawEmailForm />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Recently stored{shown > RECENT_LIMIT ? ` (latest ${RECENT_LIMIT})` : ""}
        </h2>
        <nav aria-label="Filter by disposition" className="mb-4 flex flex-wrap gap-2 text-sm">
          <FilterLink href="/dev/raw-emails" active={!filter} label={`All (${total})`} />
          {(Object.keys(FILTER_LABELS) as DispositionFilter[]).map((value) => (
            <FilterLink
              key={value}
              href={`/dev/raw-emails?disposition=${value}`}
              active={filter === value}
              label={`${FILTER_LABELS[value]} (${counts[value]})`}
            />
          ))}
        </nav>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {filter ? "No emails match this filter." : "No raw emails stored yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map(({ email, parse }) => {
              const ignored = parse?.disposition === "IGNORED";
              return (
                <li
                  key={email.id}
                  data-disposition={parse?.disposition ?? "UNPARSED"}
                  className={`rounded-lg border p-4 text-sm ${
                    ignored
                      ? "border-dashed border-zinc-300 bg-zinc-50 opacity-70 dark:border-zinc-700 dark:bg-zinc-900/50"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {email.subject || <span className="italic text-zinc-500">(no subject)</span>}
                    </p>
                    {parse && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${DISPOSITION_BADGE[parse.disposition]}`}
                      >
                        {FILTER_LABELS[parse.disposition]}
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
                    <dt>From</dt>
                    <dd className="break-all">{email.sender}</dd>
                    <dt>To</dt>
                    <dd className="break-all">{email.recipient}</dd>
                    <dt>Received</dt>
                    <dd>{timestampFormat.format(new Date(email.receivedAt))} UTC</dd>
                    <dt>Stored</dt>
                    <dd>{timestampFormat.format(new Date(email.createdAt))} UTC</dd>
                    <dt>ID</dt>
                    <dd className="font-mono text-xs break-all">{email.id}</dd>
                    <dt>Message ID</dt>
                    <dd className="font-mono text-xs break-all">{email.providerMessageId}</dd>
                    {email.threadId && (
                      <>
                        <dt>Thread ID</dt>
                        <dd className="font-mono text-xs break-all">{email.threadId}</dd>
                      </>
                    )}
                    <dt>Processed</dt>
                    <dd>{email.processed ? "Yes" : "No"}</dd>
                  </dl>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">
                      Raw body ({email.body.length.toLocaleString("en-US")} chars)
                    </summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                      {email.body}
                    </pre>
                  </details>
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    {parse ? (
                      <ParseResultPanel parse={parse} />
                    ) : (
                      <p className="mb-2 text-zinc-500">Not parsed yet.</p>
                    )}
                    <div className="mt-2">
                      <ParseEmailButton rawEmailId={email.id} alreadyParsed={parse !== null} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </Link>
  );
}

function ParseResultPanel({ parse }: { parse: EmailParseDTO }) {
  return (
    <div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
        <dt>Classification</dt>
        <dd className="font-medium text-zinc-900 dark:text-zinc-100">
          {CLASSIFICATION_LABELS[parse.classification]}
        </dd>
        <dt>Disposition</dt>
        <dd>{FILTER_LABELS[parse.disposition]}</dd>
        <dt>Needs review</dt>
        <dd>{parse.needsReview ? "Yes" : "No"}</dd>
        <dt>Company</dt>
        <dd>{parse.company ?? <span className="italic">not identified</span>}</dd>
        <dt>Position</dt>
        <dd>{parse.position ?? <span className="italic">not identified</span>}</dd>
        <dt>Confidence</dt>
        <dd>
          {parse.confidence.toFixed(2)}
          {parse.parserType === "RULE_BASED" && " (rule-based heuristic)"}
        </dd>
        <dt>Secondary signals</dt>
        <dd>
          {parse.secondarySignals.length > 0
            ? parse.secondarySignals.map((signal) => CLASSIFICATION_LABELS[signal]).join(", ")
            : "None"}
        </dd>
        <dt>Parser</dt>
        <dd className="font-mono text-xs">
          {parse.parserType} · {parse.parserVersion}
        </dd>
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">
          Evidence ({parse.evidence.length})
        </summary>
        <ul className="mt-2 list-disc pl-5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {parse.evidence.map((line, index) => (
            <li key={index} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
