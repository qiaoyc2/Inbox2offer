"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRawEmail,
  DuplicateRawEmailError,
} from "@/lib/services/raw-email-service";
import {
  createRawEmailSchema,
  type CreateRawEmailField,
} from "@/lib/validation/raw-email";

type FormValues = Record<CreateRawEmailField, string>;

export type CreateRawEmailState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      stored: { id: string; providerMessageId: string; bodyLength: number };
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<CreateRawEmailField, string[]>>;
      values: FormValues;
    };

function readField(formData: FormData, name: CreateRawEmailField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createRawEmailAction(
  _prevState: CreateRawEmailState,
  formData: FormData,
): Promise<CreateRawEmailState> {
  const values: FormValues = {
    providerMessageId: readField(formData, "providerMessageId"),
    threadId: readField(formData, "threadId"),
    sender: readField(formData, "sender"),
    recipient: readField(formData, "recipient"),
    subject: readField(formData, "subject"),
    receivedAt: readField(formData, "receivedAt"),
    body: readField(formData, "body"),
  };

  const parsed = createRawEmailSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  let stored;
  try {
    stored = await createRawEmail(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateRawEmailError) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: {
          providerMessageId: ["An email with this message ID is already stored"],
        },
        values,
      };
    }
    console.error("Failed to store raw email", error);
    return {
      status: "error",
      message: "Could not store the email. Please try again.",
      values,
    };
  }

  revalidatePath("/dev/raw-emails");
  return {
    status: "success",
    message: `Stored raw email ${stored.id}.`,
    stored: {
      id: stored.id,
      providerMessageId: stored.providerMessageId,
      bodyLength: stored.body.length,
    },
  };
}
