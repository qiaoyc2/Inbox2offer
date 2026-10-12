import { z } from "zod";
import { EMAIL_DISPOSITIONS } from "@/lib/parsing/contract";

export const parseRawEmailSchema = z.object({
  rawEmailId: z
    .string({ error: "Email ID is required" })
    .trim()
    .min(1, { error: "Email ID is required" })
    .max(100, { error: "Email ID is too long" }),
});

export const DISPOSITION_FILTERS = [...EMAIL_DISPOSITIONS, "UNPARSED"] as const;
export type DispositionFilter = (typeof DISPOSITION_FILTERS)[number];

/** Unknown or missing values mean "no filter". */
export const dispositionFilterSchema = z.enum(DISPOSITION_FILTERS).optional().catch(undefined);
