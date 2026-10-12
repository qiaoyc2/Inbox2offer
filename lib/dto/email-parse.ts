import type {
  EmailDisposition,
  EmailEventType,
  EmailParserType,
  RawEmail,
} from "@prisma/client";
import { z } from "zod";
import { RECRUITING_CLASSIFICATIONS, dispositionNeedsReview } from "@/lib/parsing/contract";

export type EmailParseDTO = {
  rawEmailId: string;
  classification: EmailEventType;
  disposition: EmailDisposition;
  company: string | null;
  position: string | null;
  confidence: number;
  needsReview: boolean;
  parserType: EmailParserType;
  parserVersion: string;
  evidence: string[];
  secondarySignals: EmailEventType[];
};

const storedEvidence = z.array(z.string()).catch([]);
const storedSignals = z.array(z.enum(RECRUITING_CLASSIFICATIONS)).catch([]);

/** Returns null for emails that have not been parsed yet. */
export function toEmailParseDTO(email: RawEmail): EmailParseDTO | null {
  if (!email.disposition || !email.classification || !email.parserType || !email.parserVersion) {
    return null;
  }
  return {
    rawEmailId: email.id,
    classification: email.classification,
    disposition: email.disposition,
    company: email.parsedCompany,
    position: email.parsedPosition,
    confidence: email.classificationConfidence ?? 0,
    needsReview: dispositionNeedsReview(email.disposition),
    parserType: email.parserType,
    parserVersion: email.parserVersion,
    evidence: storedEvidence.parse(email.parseEvidence),
    secondarySignals: storedSignals.parse(email.parseSecondarySignals),
  };
}
