import { Prisma, PrismaClient } from "@prisma/client";
import { roundMoney, toMoney } from "./echeance_paiement";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function computeOutstandingOverdueAmount(
  prisma: DbClient,
  eleveId: string,
  anneeScolaireId: string,
) {
  const echeances = await prisma.echeancePaiement.findMany({
    where: {
      eleve_id: eleveId,
      annee_scolaire_id: anneeScolaireId,
      statut: { notIn: ["PAYEE", "ANNULEE"] },
      montant_restant: { gt: 0 },
    } as never,
    select: {
      montant_restant: true,
      date_echeance: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return roundMoney(
    echeances.reduce((sum, item) => {
      const dueDate = new Date(item.date_echeance);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate > today) return sum;
      return sum + toMoney(item.montant_restant);
    }, 0),
  );
}

export async function autoLiftAdministrativeRestrictions(
  prisma: DbClient,
  args: {
    tenantId: string;
    eleveId: string;
    anneeScolaireId: string;
    utilisateurId?: string | null;
  },
) {
  const overdueAmount = await computeOutstandingOverdueAmount(
    prisma,
    args.eleveId,
    args.anneeScolaireId,
  );

  if (overdueAmount > 0) {
    return { lifted: 0, remaining_overdue_amount: overdueAmount };
  }

  const activeRestrictions = await prisma.restrictionAdministrative.findMany({
    where: {
      etablissement_id: args.tenantId,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      statut: "ACTIVE",
    } as never,
    select: { id: true },
  });

  if (activeRestrictions.length === 0) {
    return { lifted: 0, remaining_overdue_amount: 0 };
  }

  await prisma.restrictionAdministrative.updateMany({
    where: {
      id: { in: activeRestrictions.map((item) => item.id) },
    } as never,
    data: {
      statut: "LEVEE",
      date_levee: new Date(),
      levee_par_utilisateur_id: args.utilisateurId ?? null,
    } as never,
  });

  return {
    lifted: activeRestrictions.length,
    remaining_overdue_amount: 0,
  };
}

export async function assertNoAdministrativeRestriction(
  prisma: DbClient,
  args: {
    tenantId: string;
    eleveId: string;
    anneeScolaireId: string;
    type: "BULLETIN" | "EXAMEN" | "REINSCRIPTION";
  },
) {
  const restriction = await prisma.restrictionAdministrative.findFirst({
    where: {
      etablissement_id: args.tenantId,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      type: args.type,
      statut: "ACTIVE",
    } as never,
    orderBy: [{ created_at: "desc" }],
  });

  if (!restriction) return;

  throw new Error(
    `Une restriction administrative active bloque actuellement l'operation ${args.type.toLowerCase()}.`,
  );
}
