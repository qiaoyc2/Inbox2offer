import "server-only";

import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toApplicationDTO, type ApplicationDTO } from "@/lib/dto/application";
import type { CreateApplicationInput } from "@/lib/validation/application";

export async function createApplication(
  input: CreateApplicationInput,
): Promise<ApplicationDTO> {
  const application = await prisma.application.create({
    data: {
      company: input.company,
      position: input.position,
      location: input.location,
      applicationDate: input.applicationDate,
      notes: input.notes,
      currentStatus: ApplicationStatus.APPLIED,
    },
  });

  return toApplicationDTO(application);
}

export async function listApplications(): Promise<ApplicationDTO[]> {
  const applications = await prisma.application.findMany({
    orderBy: [{ applicationDate: "desc" }, { createdAt: "desc" }],
  });

  return applications.map(toApplicationDTO);
}
