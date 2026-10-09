import type { EmailEventType, RawEmail } from "@prisma/client";

export type RawEmailDTO = {
  id: string;
  providerMessageId: string;
  threadId: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  receivedAt: string;
  processed: boolean;
  classification: EmailEventType | null;
  createdAt: string;
};

export function toRawEmailDTO(email: RawEmail): RawEmailDTO {
  return {
    id: email.id,
    providerMessageId: email.providerMessageId,
    threadId: email.threadId,
    sender: email.sender,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    receivedAt: email.receivedAt.toISOString(),
    processed: email.processed,
    classification: email.classification,
    createdAt: email.createdAt.toISOString(),
  };
}
