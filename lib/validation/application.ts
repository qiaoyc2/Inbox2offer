import { z } from "zod";

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` })
    .optional()
    .transform((value) => value || null);

export const createApplicationSchema = z.object({
  company: requiredText("Company", 200),
  position: requiredText("Position", 200),
  location: optionalText("Location", 200),
  // Stored as UTC midnight so the calendar date round-trips regardless of timezone.
  applicationDate: z.iso
    .date({ error: "Enter a valid application date" })
    .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  notes: optionalText("Notes", 5000),
});

export type CreateApplicationInput = z.output<typeof createApplicationSchema>;
export type CreateApplicationField = keyof z.input<typeof createApplicationSchema>;
