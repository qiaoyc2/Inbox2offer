import { z } from "zod";

// Keeps a submission under the default 1MB Server Action body limit even for 4-byte UTF-8 characters.
export const MAX_RAW_EMAIL_BODY_LENGTH = 200_000;
const MAX_HEADER_LENGTH = 998;
const ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;

const emailAddress = z.email();
const bracketedAddress = /<([^<>]+)>$/;

const mailbox = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(MAX_HEADER_LENGTH, {
      error: `${label} must be ${MAX_HEADER_LENGTH} characters or fewer`,
    })
    .refine(
      (value) =>
        emailAddress.safeParse(value.match(bracketedAddress)?.[1] ?? value)
          .success,
      {
        error: `${label} must be an address like name@example.com or Name <name@example.com>`,
      },
    );

const optionalIdentifier = (label: string) =>
  z
    .string()
    .trim()
    .max(MAX_HEADER_LENGTH, {
      error: `${label} must be ${MAX_HEADER_LENGTH} characters or fewer`,
    })
    .optional()
    .transform((value) => value || null);

export const createRawEmailSchema = z.object({
  providerMessageId: optionalIdentifier("Message ID"),
  threadId: optionalIdentifier("Thread ID"),
  sender: mailbox("Sender"),
  recipient: mailbox("Recipient"),
  subject: z
    .string()
    .trim()
    .max(MAX_HEADER_LENGTH, {
      error: `Subject must be ${MAX_HEADER_LENGTH} characters or fewer`,
    })
    .default(""),
  receivedAt: z.iso
    .datetime({ offset: true, error: "Enter a valid received time" })
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() <= Date.now() + ALLOWED_CLOCK_SKEW_MS, {
      error: "Received time can't be in the future",
    }),
  // The body is stored verbatim, so it is checked but never trimmed or transformed.
  body: z
    .string({ error: "Body is required" })
    .max(MAX_RAW_EMAIL_BODY_LENGTH, {
      error: `Body must be ${MAX_RAW_EMAIL_BODY_LENGTH.toLocaleString("en-US")} characters or fewer`,
    })
    .refine((value) => value.trim().length > 0, { error: "Body is required" }),
});

export type CreateRawEmailInput = z.output<typeof createRawEmailSchema>;
export type CreateRawEmailField = keyof z.input<typeof createRawEmailSchema>;
