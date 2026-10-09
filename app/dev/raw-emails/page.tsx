import Link from "next/link";
import { connection } from "next/server";
import { RawEmailForm } from "@/app/_components/raw-email-form";
import {
  countRawEmails,
  listRecentRawEmails,
} from "@/lib/services/raw-email-service";

const RECENT_LIMIT = 20;

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

export default async function RawEmailsDevPage() {
  await connection();
  const [emails, total] = await Promise.all([
    listRecentRawEmails(RECENT_LIMIT),
    countRawEmails(),
  ]);

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
          Development tool. Emails are stored exactly as submitted and are not
          parsed or linked to applications. {total} stored.
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
          Recently stored{total > RECENT_LIMIT ? ` (latest ${RECENT_LIMIT})` : ""}
        </h2>
        {emails.length === 0 ? (
          <p className="text-sm text-zinc-500">No raw emails stored yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {emails.map((email) => (
              <li
                key={email.id}
                className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {email.subject || <span className="italic text-zinc-500">(no subject)</span>}
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
