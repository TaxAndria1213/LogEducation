import { PrismaClient } from "@prisma/client";
import { Request } from "express";

export const ACTIVE_ACADEMIC_ENROLLMENT_STATUSES = ["INSCRIT", "VALIDEE"] as const;

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
    etablissement_id?: string | null;
    role?: string[];
  };
};

export async function getRequiredActiveAcademicYear(
  prisma: PrismaClient,
  tenantId: string,
) {
  const activeYear = await prisma.anneeScolaire.findFirst({
    where: {
      etablissement_id: tenantId,
      est_active: true,
    },
    select: {
      id: true,
      nom: true,
      date_debut: true,
      date_fin: true,
    },
  });

  if (!activeYear) {
    throw new Error("Aucune annee scolaire courante n'est definie.");
  }

  return activeYear;
}

export function getRequestUserId(req: Request): string | null {
  const user = (req as AuthenticatedRequest).user;
  const candidates = [user?.sub, user?.id];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}
