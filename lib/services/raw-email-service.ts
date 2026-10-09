import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toRawEmailDTO, type RawEmailDTO } from "@/lib/dto/raw-email";
import type { CreateRawEmailInput } from "@/lib/validation/raw-email";

export class DuplicateRawEmailError extends Error {
  constructor(providerMessageId: string) {
    super(`A raw email with providerMessageId "${providerMessageId}" already exists`);
    this.name = "DuplicateRawEmailError";
  }
}

export async function createRawEmail(
  input: CreateRawEmailInput,
): Promise<RawEmailDTO> {
  const providerMessageId = input.providerMessageId ?? `manual-${randomUUID()}`;

  try {
    const email = await prisma.rawEmail.create({
      data: {
        providerMessageId,
        threadId: input.threadId,
        sender: input.sender,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        receivedAt: input.receivedAt,
      },
    });

    return toRawEmailDTO(email);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateRawEmailError(providerMessageId);
    }
    throw error;
  }
}

export async function listRecentRawEmails(limit = 20): Promise<RawEmailDTO[]> {
  const emails = await prisma.rawEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return emails.map(toRawEmailDTO);
}

export async function countRawEmails(): Promise<number> {
  return prisma.rawEmail.count();
}
