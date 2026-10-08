import { connection } from "next/server";
import { NewApplicationForm } from "@/app/_components/new-application-form";
import { listApplications } from "@/lib/services/application-service";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatStatus(status: string): string {
  const words = status.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function Home() {
  await connection();
  const applications = await listApplications();
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12 font-sans">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Inbox2Offer
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {applications.length} application{applications.length === 1 ? "" : "s"} tracked
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Add application
        </h2>
        <NewApplicationForm today={today} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Applications
        </h2>
        {applications.length === 0 ? (
          <p className="text-sm text-zinc-500">No applications yet. Add your first one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Position</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Applied</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {applications.map((application) => (
                  <tr key={application.id} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-4 py-2">{application.company}</td>
                    <td className="px-4 py-2">{application.position}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {application.location ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {dateFormat.format(new Date(application.applicationDate))}
                    </td>
                    <td className="px-4 py-2">{formatStatus(application.currentStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
