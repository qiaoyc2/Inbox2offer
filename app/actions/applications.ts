"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApplication } from "@/lib/services/application-service";
import {
  createApplicationSchema,
  type CreateApplicationField,
} from "@/lib/validation/application";

type FormValues = Record<CreateApplicationField, string>;

export type CreateApplicationState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<CreateApplicationField, string[]>>;
      values: FormValues;
    };

function readField(formData: FormData, name: CreateApplicationField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createApplicationAction(
  _prevState: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const values: FormValues = {
    company: readField(formData, "company"),
    position: readField(formData, "position"),
    location: readField(formData, "location"),
    applicationDate: readField(formData, "applicationDate"),
    notes: readField(formData, "notes"),
  };

  const parsed = createApplicationSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  try {
    await createApplication(parsed.data);
  } catch (error) {
    console.error("Failed to create application", error);
    return {
      status: "error",
      message: "Could not save the application. Please try again.",
      values,
    };
  }

  revalidatePath("/");
  return {
    status: "success",
    message: `Added ${parsed.data.position} at ${parsed.data.company}.`,
  };
}
