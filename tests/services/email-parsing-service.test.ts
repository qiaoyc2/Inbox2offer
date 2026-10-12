import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { parseRawEmailAction } from "@/app/actions/email-parsing";
import type { EmailParser, ParseResult } from "@/lib/parsing/contract";
import { prisma } from "@/lib/prisma";
import {
  countRawEmailsByDisposition,
  InvalidParseResultError,
  listRecentRawEmailsWithParse,
  parseStoredRawEmail,
  RawEmailNotFoundError,
} from "@/lib/services/email-parsing-service";
import { createRawEmail } from "@/lib/services/raw-email-service";

if (!process.env.DATABASE_URL?.endsWith("/test.db")) {
  throw new Error(`Refusing to run persistence tests against ${process.env.DATABASE_URL}`);
}

const receivedAt = new Date("2026-10-01T12:00:00Z");

function storeEmail(subject: string, body: string, sender = "Acme Recruiting <jobs@acme.example>") {
  return createRawEmail({
    providerMessageId: null,
    threadId: null,
    sender,
    recipient: "me@example.com",
    subject,
    body,
    receivedAt,
  });
}

const INTERVIEW = {
  subject: "Interview Invitation — Data Engineer",
  // CRLF, tabs, and trailing whitespace must survive parsing byte for byte.
  body: "Hi Sam,\r\n\r\nWe'd like to schedule an interview for the Data Engineer position.\t \r\n\r\nBest,\r\nJane  \r\n",
};
const PROMO = {
  subject: "Your weekend shopping discounts",
  body: "Save 25% on selected clothing this weekend.",
};
const AMBIGUOUS = { subject: "Checking in", body: "Let me know when you are available to talk." };

function formWith(rawEmailId: string) {
  const formData = new FormData();
  formData.set("rawEmailId", rawEmailId);
  return formData;
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await prisma.applicationEvent.deleteMany();
  await prisma.reviewItem.deleteMany();
  await prisma.rawEmail.deleteMany();
  await prisma.application.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("parseStoredRawEmail", () => {
  it("stores the parse metadata and disposition", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);

    const result = await parseStoredRawEmail(email.id);

    const row = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(row.classification).toBe("INTERVIEW");
    expect(row.disposition).toBe("JOB_RELATED");
    expect(row.classificationConfidence).toBe(result.confidence);
    expect(row.parsedPosition).toBe("Data Engineer");
    expect(row.parserType).toBe("RULE_BASED");
    expect(row.parserVersion).toBe(result.parserVersion);
    expect(row.parseEvidence).toEqual(result.evidence);
    expect(row.parseSecondarySignals).toEqual(result.secondarySignals);
    expect(result).toMatchObject({ rawEmailId: email.id, needsReview: false });
  });

  it("keeps ignored and needs-review emails separately identifiable", async () => {
    const promo = await storeEmail(PROMO.subject, PROMO.body, "Shop <deals@shop.example>");
    const ambiguous = await storeEmail(AMBIGUOUS.subject, AMBIGUOUS.body, "friend@example.com");
    const unparsed = await storeEmail("Unparsed", "Not parsed yet.");

    expect((await parseStoredRawEmail(promo.id)).disposition).toBe("IGNORED");
    expect((await parseStoredRawEmail(ambiguous.id)).disposition).toBe("NEEDS_REVIEW");

    const ignored = await listRecentRawEmailsWithParse(20, "IGNORED");
    expect(ignored.map((item) => item.email.id)).toEqual([promo.id]);
    const review = await listRecentRawEmailsWithParse(20, "NEEDS_REVIEW");
    expect(review.map((item) => item.email.id)).toEqual([ambiguous.id]);
    const pending = await listRecentRawEmailsWithParse(20, "UNPARSED");
    expect(pending.map((item) => item.email.id)).toEqual([unparsed.id]);
    expect(pending[0].parse).toBeNull();

    expect(await countRawEmailsByDisposition()).toEqual({
      JOB_RELATED: 0,
      NEEDS_REVIEW: 1,
      IGNORED: 1,
      UNPARSED: 1,
    });
  });

  it("leaves the raw email content and processed flag unchanged", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);
    const before = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });

    await parseStoredRawEmail(email.id);

    const after = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(after.body).toBe(INTERVIEW.body);
    for (const field of [
      "providerMessageId", "threadId", "sender", "recipient", "subject", "body", "receivedAt",
      "processed", "createdAt",
    ] as const) {
      expect(after[field]).toEqual(before[field]);
    }
    expect(after.processed).toBe(false);
  });

  it("is idempotent when parsed repeatedly", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);

    const first = await parseStoredRawEmail(email.id);
    const rowAfterFirst = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });
    const second = await parseStoredRawEmail(email.id);
    const rowAfterSecond = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });

    expect(second).toEqual(first);
    expect(rowAfterSecond).toEqual(rowAfterFirst);
    expect(await prisma.rawEmail.count()).toBe(1);
  });

  it("does not create or modify applications, events, or review items", async () => {
    const application = await prisma.application.create({
      data: { company: "Acme", position: "Data Engineer", applicationDate: receivedAt },
    });
    const applicationsBefore = await prisma.application.findMany();
    const emails = await Promise.all([
      storeEmail(INTERVIEW.subject, INTERVIEW.body),
      storeEmail(PROMO.subject, PROMO.body, "Shop <deals@shop.example>"),
      storeEmail("Job Offer — Backend Engineer", "We are pleased to offer you the Backend Engineer position."),
      storeEmail("Update on your application", "We have decided to move forward with other candidates."),
    ]);

    for (const email of emails) await parseStoredRawEmail(email.id);

    expect(await prisma.application.findMany()).toEqual(applicationsBefore);
    expect(applicationsBefore[0].currentStatus).toBe(application.currentStatus);
    expect(await prisma.applicationEvent.count()).toBe(0);
    expect(await prisma.reviewItem.count()).toBe(0);
  });

  it("does not turn an ignored email into an application", async () => {
    const promo = await storeEmail(PROMO.subject, PROMO.body, "Shop <deals@shop.example>");
    await parseStoredRawEmail(promo.id);
    expect(await prisma.application.count()).toBe(0);
  });

  it("reports a missing email", async () => {
    await expect(parseStoredRawEmail("does-not-exist")).rejects.toBeInstanceOf(RawEmailNotFoundError);
  });

  it("rejects an invalid parser result without writing anything", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);
    const broken: EmailParser = {
      parse: async () =>
        ({ classification: "INTERVIEW", disposition: "IGNORED", confidence: 3 }) as unknown as ParseResult,
    };

    await expect(parseStoredRawEmail(email.id, broken)).rejects.toBeInstanceOf(InvalidParseResultError);

    const row = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(row.disposition).toBeNull();
    expect(row.classification).toBeNull();
  });

  it("propagates database errors without partial writes", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);
    vi.spyOn(prisma.rawEmail, "update").mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"));

    await expect(parseStoredRawEmail(email.id)).rejects.toThrow("SQLITE_BUSY");

    const row = await prisma.rawEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(row.disposition).toBeNull();
  });
});

describe("parseRawEmailAction", () => {
  it("parses and reports the result", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);
    const state = await parseRawEmailAction({ status: "idle" }, formWith(email.id));
    expect(state).toEqual({ status: "success", message: "Parsed: INTERVIEW · JOB_RELATED" });
  });

  it("rejects a missing ID", async () => {
    const state = await parseRawEmailAction({ status: "idle" }, new FormData());
    expect(state).toEqual({ status: "error", message: "Invalid email ID." });
  });

  it("reports an email that no longer exists", async () => {
    const state = await parseRawEmailAction({ status: "idle" }, formWith("does-not-exist"));
    expect(state).toEqual({ status: "error", message: "This email no longer exists." });
  });

  it("returns a generic message on database failure without leaking details", async () => {
    const email = await storeEmail(INTERVIEW.subject, INTERVIEW.body);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.rawEmail, "update").mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"));

    const state = await parseRawEmailAction({ status: "idle" }, formWith(email.id));

    expect(state).toEqual({ status: "error", message: "Could not parse the email. Please try again." });
    expect(console.error).toHaveBeenCalled();
  });
});
