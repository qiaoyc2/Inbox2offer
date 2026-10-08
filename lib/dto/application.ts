import type { Application, ApplicationStatus } from "@prisma/client";

export type ApplicationDTO = {
  id: string;
  company: string;
  position: string;
  location: string | null;
  applicationDate: string;
  currentStatus: ApplicationStatus;
  lastEventAt: string | null;
  notes: string | null;
  needsUserReview: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toApplicationDTO(application: Application): ApplicationDTO {
  return {
    id: application.id,
    company: application.company,
    position: application.position,
    location: application.location,
    applicationDate: application.applicationDate.toISOString(),
    currentStatus: application.currentStatus,
    lastEventAt: application.lastEventAt?.toISOString() ?? null,
    notes: application.notes,
    needsUserReview: application.needsUserReview,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
