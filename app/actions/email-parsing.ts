"use server";

import { revalidatePath } from "next/cache";
import {
  parseStoredRawEmail,
  RawEmailNotFoundError,
} from "@/lib/services/email-parsing-service";
import { parseRawEmailSchema } from "@/lib/validation/email-parsing";

export type ParseRawEmailState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function parseRawEmailAction(
  _prevState: ParseRawEmailState,
  formData: FormData,
): Promise<ParseRawEmailState> {
  const parsed = parseRawEmailSchema.safeParse({ rawEmailId: formData.get("rawEmailId") });
  if (!parsed.success) {
    return { status: "error", message: "Invalid email ID." };
  }

  let result;
  try {
    result = await parseStoredRawEmail(parsed.data.rawEmailId);
  } catch (error) {
    if (error instanceof RawEmailNotFoundError) {
      return { status: "error", message: "This email no longer exists." };
    }
    console.error("Failed to parse raw email", error);
    return { status: "error", message: "Could not parse the email. Please try again." };
  }

  revalidatePath("/dev/raw-emails");
  return {
    status: "success",
    message: `Parsed: ${result.classification} · ${result.disposition}`,
  };
}
