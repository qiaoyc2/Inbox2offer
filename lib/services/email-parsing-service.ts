import "server-only";

import { Prisma, type EmailEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toEmailParseDTO, type EmailParseDTO } from "@/lib/dto/email-parse";
import { toRawEmailDTO, type RawEmailDTO } from "@/lib/dto/raw-email";
import { parseResultSchema, type EmailParser, type ParseResult } from "@/lib/parsing/contract";
import { createEmailParser } from "@/lib/parsing/modes";
import type { DispositionFilter } from "@/lib/validation/email-parsing";

export class RawEmailNotFoundError extends Error {
  constructor(id: string) {
    super(`Raw email "${id}" was not found`);
    this.name = "RawEmailNotFoundError";
  }
}

export class InvalidParseResultError extends Error {
  constructor(details: string) {
    super(`Parser returned an invalid result: ${details}`);
    this.name = "InvalidParseResultError";
  }
}

export type RawEmailWithParse = { email: RawEmailDTO; parse: EmailParseDTO | null };

function toParseColumns(result: ParseResult) {
  return {
    classification: result.classification satisfies EmailEventType,
    classificationConfidence: result.confidence,
    disposition: result.disposition,
    parsedCompany: result.company,
    parsedPosition: result.position,
    parserType: result.parserType,
    parserVersion: result.parserVersion,
    parseEvidence: result.evidence,
    parseSecondarySignals: result.secondarySignals satisfies EmailEventType[],
  };
}

/**
 * Parses a stored email and overwrites its previous parse metadata, so reparsing is idempotent.
 * Only parse columns are written: the raw content, `processed`, and all application records are untouched.
 */
export async function parseStoredRawEmail(
  id: string,
  parser: EmailParser = createEmailParser("BASIC"),
): Promise<EmailParseDTO> {
  const email = await prisma.rawEmail.findUnique({
    where: { id },
    select: { sender: true, subject: true, body: true },
  });
  if (!email) throw new RawEmailNotFoundError(id);

  const checked = parseResultSchema.safeParse(await parser.parse(email));
  if (!checked.success) {
    throw new InvalidParseResultError(checked.error.issues.map((issue) => issue.message).join("; "));
  }

  try {
    const updated = await prisma.rawEmail.update({
      where: { id },
      data: toParseColumns(checked.data),
    });
    return toEmailParseDTO(updated)!;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new RawEmailNotFoundError(id);
    }
    throw error;
  }
}

export async function listRecentRawEmailsWithParse(
  limit = 20,
  filter?: DispositionFilter,
): Promise<RawEmailWithParse[]> {
  const emails = await prisma.rawEmail.findMany({
    where: filter === undefined ? {} : { disposition: filter === "UNPARSED" ? null : filter },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return emails.map((email) => ({ email: toRawEmailDTO(email), parse: toEmailParseDTO(email) }));
}

export async function countRawEmailsByDisposition(): Promise<Record<DispositionFilter, number>> {
  const groups = await prisma.rawEmail.groupBy({ by: ["disposition"], _count: { _all: true } });
  const counts: Record<DispositionFilter, number> = {
    JOB_RELATED: 0,
    NEEDS_REVIEW: 0,
    IGNORED: 0,
    UNPARSED: 0,
  };
  for (const group of groups) counts[group.disposition ?? "UNPARSED"] = group._count._all;
  return counts;
}
