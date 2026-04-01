import { Prisma, PrismaClient } from "@prisma/client";

export type BillingReadinessIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

type BillingReadinessArgs = {
  tenantId: string;
  anneeScolaireId?: string | null;
  referenceDate?: Date | null;
  catalogueFraisIds?: Array<string | null | undefined>;
  requireApprovedRecurring?: boolean;
  requireActiveInscriptions?: boolean;
};

type BillingClient = PrismaClient | Prisma.TransactionClient;

function toDateOnly(value: Date) {
  return new Date(value.toISOString().slice(0, 10));
}

async function resolveAnneeScolaire(
  prisma: BillingClient,
  tenantId: string,
  anneeId: string | null | undefined,
  referenceDate: Date,
) {
  if (anneeId) {
    const annee = await prisma.anneeScolaire.findFirst({
      where: {
        id: anneeId,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
        nom: true,
        date_debut: true,
        date_fin: true,
        est_active: true,
      },
    });

    if (!annee) {
      throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    }

    return annee;
  }

  const activeYear = await prisma.anneeScolaire.findFirst({
    where: {
      etablissement_id: tenantId,
      OR: [
        { est_active: true },
        {
          AND: [
            { date_debut: { lte: referenceDate } },
            { date_fin: { gte: referenceDate } },
          ],
        },
      ],
    },
    orderBy: [{ est_active: "desc" }, { date_debut: "desc" }],
    select: {
      id: true,
      nom: true,
      date_debut: true,
      date_fin: true,
      est_active: true,
    },
  });

  if (!activeYear) {
    throw new Error("Aucune annee scolaire active ou correspondante a la date n'a ete trouvee.");
  }

  return activeYear;
}

export async function assessBillingReadiness(
  prisma: BillingClient,
  args: BillingReadinessArgs,
) {
  const referenceDate = toDateOnly(args.referenceDate ?? new Date());
  const annee = await resolveAnneeScolaire(
    prisma,
    args.tenantId,
    args.anneeScolaireId ?? null,
    referenceDate,
  );

  const selectedCatalogueIds = Array.from(
    new Set(
      (args.catalogueFraisIds ?? [])
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );

  const shouldCountRecurring = Boolean(args.requireApprovedRecurring);
  const shouldCountInscriptions = Boolean(args.requireActiveInscriptions);

  const [approvedRecurringCount, pendingCataloguesCount, activeInscriptionsCount, selectedCatalogues] =
    await Promise.all([
      shouldCountRecurring
        ? prisma.catalogueFrais.count({
            where: {
              etablissement_id: args.tenantId,
              est_recurrent: true,
              statut_validation: "APPROUVEE",
            } as never,
          })
        : Promise.resolve(0),
      prisma.catalogueFrais.count({
        where: {
          etablissement_id: args.tenantId,
          statut_validation: { not: "APPROUVEE" },
        } as never,
      }),
      shouldCountInscriptions
        ? prisma.inscription.count({
            where: {
              annee_scolaire_id: annee.id,
              statut: "INSCRIT",
              classe: {
                etablissement_id: args.tenantId,
              },
            } as never,
          })
        : Promise.resolve(0),
      selectedCatalogueIds.length > 0
        ? prisma.catalogueFrais.findMany({
            where: {
              etablissement_id: args.tenantId,
              id: { in: selectedCatalogueIds },
            } as never,
            select: {
              id: true,
              nom: true,
              statut_validation: true,
              est_recurrent: true,
              periodicite: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const selectedCatalogueMap = new Map(selectedCatalogues.map((item) => [item.id, item]));
  const missingCatalogueIds = selectedCatalogueIds.filter((id) => !selectedCatalogueMap.has(id));
  const unapprovedSelectedCatalogues = selectedCatalogues.filter(
    (item) => (item.statut_validation ?? "").toUpperCase() !== "APPROUVEE",
  );

  const selectedTermLikeCount = selectedCatalogues.filter(
    (item) =>
      Boolean(item.est_recurrent) &&
      ["term", "semester"].includes(String(item.periodicite ?? "").toLowerCase()),
  ).length;
  const recurringTermLikeCount =
    shouldCountRecurring && selectedCatalogueIds.length === 0
      ? await prisma.catalogueFrais.count({
          where: {
            etablissement_id: args.tenantId,
            est_recurrent: true,
            statut_validation: "APPROUVEE",
            periodicite: { in: ["term", "semester"] },
          } as never,
        })
      : 0;
  const periodesRequired = selectedTermLikeCount > 0 || recurringTermLikeCount > 0;
  const periodesCount = periodesRequired
    ? await prisma.periode.count({
        where: {
          annee_scolaire_id: annee.id,
        },
      })
    : 0;

  const issues: BillingReadinessIssue[] = [];

  if (shouldCountRecurring && approvedRecurringCount === 0) {
    issues.push({
      code: "NO_APPROVED_RECURRING_FEES",
      message: "Aucun frais recurrent approuve n'est disponible pour la generation.",
      severity: "error",
    });
  }

  if (shouldCountInscriptions && activeInscriptionsCount === 0) {
    issues.push({
      code: "NO_ACTIVE_INSCRIPTIONS",
      message: "Aucune inscription active n'a ete trouvee sur l'annee scolaire cible.",
      severity: "error",
    });
  }

  if (missingCatalogueIds.length > 0) {
    issues.push({
      code: "MISSING_SELECTED_CATALOGUES",
      message: "Certains frais selectionnes n'appartiennent pas a cet etablissement ou n'existent plus.",
      severity: "error",
    });
  }

  if (unapprovedSelectedCatalogues.length > 0) {
    issues.push({
      code: "UNAPPROVED_SELECTED_CATALOGUES",
      message: `Les frais suivants doivent etre approuves avant facturation: ${unapprovedSelectedCatalogues
        .map((item) => item.nom)
        .join(", ")}.`,
      severity: "error",
    });
  }

  if (periodesRequired && periodesCount === 0) {
    issues.push({
      code: "NO_PERIODS_CONFIGURED",
      message: "Des frais trimestriels ou semestriels existent mais aucune periode scolaire n'est configuree.",
      severity: "error",
    });
  }

  if (pendingCataloguesCount > 0) {
    issues.push({
      code: "PENDING_CATALOGUES",
      message: `${pendingCataloguesCount} frais catalogue ne sont pas encore approuves.`,
      severity: "warning",
    });
  }

  return {
    ready: !issues.some((item) => item.severity === "error"),
    annee_scolaire_id: annee.id,
    annee_label: annee.nom,
    approved_recurring_count: approvedRecurringCount,
    active_inscriptions_count: activeInscriptionsCount,
    periodes_count: periodesCount,
    selected_catalogues_count: selectedCatalogues.length,
    pending_catalogues_count: pendingCataloguesCount,
    issues,
  };
}
