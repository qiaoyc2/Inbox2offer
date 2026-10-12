import { z } from "zod";

// Values mirror the Prisma enums (EmailEventType, EmailDisposition, EmailParserType)
// so results can be persisted directly, but this module must stay free of Prisma and React.

export const RECRUITING_CLASSIFICATIONS = [
  "APPLICATION_CONFIRMATION",
  "INTERVIEW",
  "REJECTION",
  "OFFER",
  "ADDITIONAL_INFORMATION_REQUEST",
] as const;

export const EMAIL_CLASSIFICATIONS = [
  ...RECRUITING_CLASSIFICATIONS,
  "UNRELATED",
  "UNKNOWN",
] as const;

export const EMAIL_DISPOSITIONS = ["JOB_RELATED", "NEEDS_REVIEW", "IGNORED"] as const;

export const PARSER_TYPES = ["RULE_BASED", "AI"] as const;

export type RecruitingClassification = (typeof RECRUITING_CLASSIFICATIONS)[number];
export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];
export type EmailDisposition = (typeof EMAIL_DISPOSITIONS)[number];
export type ParserType = (typeof PARSER_TYPES)[number];

export const MAX_EVIDENCE_ITEMS = 25;
export const MAX_EVIDENCE_LENGTH = 300;
const MAX_EXTRACTED_LENGTH = 120;

export function dispositionNeedsReview(disposition: EmailDisposition): boolean {
  return disposition === "NEEDS_REVIEW";
}

export const emailParserInputSchema = z.object({
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
});

export type EmailParserInput = z.infer<typeof emailParserInputSchema>;

const extractedText = z.string().trim().min(1).max(MAX_EXTRACTED_LENGTH).nullable();

export const parseResultSchema = z
  .object({
    classification: z.enum(EMAIL_CLASSIFICATIONS),
    disposition: z.enum(EMAIL_DISPOSITIONS),
    company: extractedText,
    position: extractedText,
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
    parserType: z.enum(PARSER_TYPES),
    parserVersion: z.string().trim().min(1).max(50),
    evidence: z.array(z.string().max(MAX_EVIDENCE_LENGTH)).max(MAX_EVIDENCE_ITEMS),
    secondarySignals: z.array(z.enum(RECRUITING_CLASSIFICATIONS)),
  })
  .refine((result) => result.needsReview === dispositionNeedsReview(result.disposition), {
    error: "needsReview must be true exactly when disposition is NEEDS_REVIEW",
    path: ["needsReview"],
  })
  .refine(
    (result) =>
      result.disposition !== "JOB_RELATED" ||
      (RECRUITING_CLASSIFICATIONS as readonly string[]).includes(result.classification),
    {
      error: "JOB_RELATED requires a recruiting classification",
      path: ["disposition"],
    },
  )
  .refine(
    (result) => result.disposition !== "IGNORED" || result.classification === "UNRELATED",
    {
      error: "IGNORED requires the UNRELATED classification",
      path: ["disposition"],
    },
  )
  .refine((result) => !result.secondarySignals.includes(result.classification as RecruitingClassification), {
    error: "The primary classification can't also be a secondary signal",
    path: ["secondarySignals"],
  });

export type ParseResult = z.infer<typeof parseResultSchema>;

export interface EmailParser {
  parse(email: EmailParserInput): Promise<ParseResult>;
}
