import {
  Prisma,
  type EcheancePaiement,
  type Paiement,
  type PrismaClient,
  type StatutEcheancePaiement,
} from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type EcheanceInput = {
  ordre?: number;
  date: string | Date;
  montant: number;
  statut?: string | null;
  libelle?: string | null;
  note?: string | null;
  devise?: string | null;
};

type NormalizedEcheanceInput = {
  ordre: number;
  date_echeance: Date;
  montant_prevu: number;
  libelle: string | null;
  notes: string | null;
  devise: string;
  statut: StatutEcheancePaiement;
};

type EcheanceRecord = Pick<
  EcheancePaiement,
  | "id"
  | "plan_paiement_id"
  | "facture_id"
  | "ordre"
  | "libelle"
  | "date_echeance"
  | "montant_prevu"
  | "montant_regle"
  | "montant_restant"
  | "statut"
  | "devise"
  | "notes"
>;

type SyncPlanArgs = {
  planId: string;
  factureId?: string | null;
  eleveId: string;
  anneeScolaireId: string;
  devise: string;
  lines: EcheanceInput[];
};

type EnsureFactureArgs = {
  factureId: string;
  lines?: EcheanceInput[];
};

type FactureWithFinanceRelations = {
  id: string;
  statut: string;
  devise: string;
  eleve_id: string;
  annee_scolaire_id: string;
  date_echeance: Date | null;
  date_emission: Date;
  numero_facture: string;
  total_montant: Prisma.Decimal | number;
  paiements: Array<Paiement & { statut?: string | null }>;
  echeances: EcheanceRecord[];
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function toMoney(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return roundMoney(number);
}

export function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function clampPaymentDay(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return Math.max(1, Math.min(28, fallback));
  return Math.max(1, Math.min(28, parsed));
}

function getActivePaiements<T extends { statut?: string | null }>(paiements: T[]) {
  return paiements.filter((item) => (item.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE");
}

export function normalizeDateOnly(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Une date d'echeance est invalide.");
  }
  return new Date(date.toISOString().slice(0, 10));
}

function normalizeRequestedStatus(value: unknown): StatutEcheancePaiement | null {
  const normalized = normalizeText(value)?.toUpperCase();
  switch (normalized) {
    case "A_VENIR":
    case "PARTIELLE":
    case "PAYEE":
    case "ANNULEE":
    case "EN_RETARD":
      return normalized;
    default:
      return null;
  }
}

export function deriveEcheanceStatus(
  montantPrevu: number,
  montantRegle: number,
  dateEcheance: Date,
  requestedStatus?: string | null,
): StatutEcheancePaiement {
  const forcedStatus = normalizeRequestedStatus(requestedStatus);
  if (forcedStatus === "ANNULEE") return "ANNULEE";

  const planned = roundMoney(Math.max(0, montantPrevu));
  const paid = roundMoney(Math.max(0, montantRegle));
  if (planned <= 0 || paid >= planned) return "PAYEE";
  if (paid > 0) return "PARTIELLE";

  const dueDate = new Date(dateEcheance);
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dueDate < today) return "EN_RETARD";
  return forcedStatus ?? "A_VENIR";
}

export function normalizeEcheanceInputs(
  lines: EcheanceInput[],
  devise = "MGA",
): NormalizedEcheanceInput[] {
  return lines.map((item, index) => {
    const montant = roundMoney(Math.max(0, toMoney(item.montant)));
    const date_echeance = normalizeDateOnly(item.date);
    return {
      ordre:
        typeof item.ordre === "number" && Number.isInteger(item.ordre) && item.ordre > 0
          ? item.ordre
          : index + 1,
      date_echeance,
      montant_prevu: montant,
      libelle: normalizeText(item.libelle) ?? `Tranche ${index + 1}`,
      notes: normalizeText(item.note),
      devise: normalizeText(item.devise)?.toUpperCase() ?? devise,
      statut: deriveEcheanceStatus(montant, 0, date_echeance, item.statut),
    };
  });
}

function mapEcheancesToPlanJson(
  basePlanJson: Prisma.JsonValue | null,
  echeances: EcheanceRecord[],
) {
  const basePlan =
    basePlanJson && typeof basePlanJson === "object" && !Array.isArray(basePlanJson)
      ? ({ ...(basePlanJson as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const montantPlanifie = roundMoney(
    echeances.reduce((sum, item) => sum + toMoney(item.montant_prevu), 0),
  );
  const montantRegle = roundMoney(
    echeances.reduce((sum, item) => sum + toMoney(item.montant_regle), 0),
  );

  return {
    ...basePlan,
    nombre_tranches: echeances.length,
    devise:
      normalizeText(basePlan.devise)?.toUpperCase() ??
      echeances[0]?.devise ??
      "MGA",
    echeances: echeances.map((item, index) => ({
      ordre: item.ordre ?? index + 1,
      date: new Date(item.date_echeance).toISOString().slice(0, 10),
      montant: toMoney(item.montant_prevu),
      statut: item.statut,
      note: item.notes ?? null,
      libelle: item.libelle ?? null,
      paid_amount: toMoney(item.montant_regle),
      remaining_amount: toMoney(item.montant_restant),
      devise: item.devise ?? "MGA",
      echeance_paiement_id: item.id,
      facture_id: item.facture_id ?? null,
    })),
    resume_financier: {
      ...(basePlan.resume_financier &&
      typeof basePlan.resume_financier === "object" &&
      !Array.isArray(basePlan.resume_financier)
        ? (basePlan.resume_financier as Record<string, unknown>)
        : {}),
      montant_planifie: montantPlanifie,
      montant_regle: montantRegle,
      montant_restant: roundMoney(Math.max(0, montantPlanifie - montantRegle)),
      updated_at: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue;
}

function buildDefaultFactureLine(facture: {
  date_echeance: Date | null;
  date_emission: Date;
  total_montant: Prisma.Decimal | number;
  devise: string;
  numero_facture: string;
}): EcheanceInput[] {
  return [
    {
      ordre: 1,
      date: facture.date_echeance ?? facture.date_emission,
      montant: toMoney(facture.total_montant),
      statut: "A_VENIR",
      libelle: facture.numero_facture,
      devise: facture.devise ?? "MGA",
      note: "Echeance unique",
    },
  ];
}

function rebalanceEcheanceLines(existing: EcheanceRecord[], total: number): EcheanceInput[] {
  const normalizedTotal = roundMoney(Math.max(0, total));
  if (existing.length === 0) return [];

  const previousTotal = roundMoney(
    existing.reduce((sum, item) => sum + toMoney(item.montant_prevu), 0),
  );

  let remaining = normalizedTotal;
  return existing.map((item, index) => {
    const montant =
      index === existing.length - 1
        ? remaining
        : previousTotal > 0
          ? roundMoney((toMoney(item.montant_prevu) / previousTotal) * normalizedTotal)
          : roundMoney(normalizedTotal / existing.length);
    remaining = roundMoney(Math.max(0, remaining - montant));
    return {
      ordre: item.ordre,
      date: item.date_echeance,
      montant,
      statut: item.statut,
      libelle: item.libelle,
      note: item.notes,
      devise: item.devise,
    };
  });
}

export async function syncPlanJsonFromEcheances(tx: DbClient, planId: string) {
  const plan = await tx.planPaiementEleve.findUnique({
    where: { id: planId },
    select: {
      id: true,
      plan_json: true,
      echeances: {
        orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
      },
    },
  });

  if (!plan) return;

  await tx.planPaiementEleve.update({
    where: { id: planId },
    data: {
      plan_json: mapEcheancesToPlanJson(
        plan.plan_json,
        plan.echeances as EcheanceRecord[],
      ),
    },
  });
}

export async function syncFactureStatusFromEcheances(tx: DbClient, factureId: string) {
  const facture = await tx.facture.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      statut: true,
      date_echeance: true,
      total_montant: true,
      echeances: {
        select: {
          montant_prevu: true,
          montant_regle: true,
          montant_restant: true,
          statut: true,
        },
      },
    },
  });

  if (!facture) return;

  const totalPlanifie =
    facture.echeances.length > 0
      ? roundMoney(facture.echeances.reduce((sum, item) => sum + toMoney(item.montant_prevu), 0))
      : toMoney(facture.total_montant);
  const totalRegle =
    facture.echeances.length > 0
      ? roundMoney(facture.echeances.reduce((sum, item) => sum + toMoney(item.montant_regle), 0))
      : 0;
  const totalRestant =
    facture.echeances.length > 0
      ? roundMoney(facture.echeances.reduce((sum, item) => sum + toMoney(item.montant_restant), 0))
      : roundMoney(Math.max(0, totalPlanifie - totalRegle));

  let statut: Prisma.FactureUncheckedUpdateInput["statut"] = "EMISE";
  if (facture.statut === "BROUILLON") {
    statut = "BROUILLON";
  } else if (facture.statut === "ANNULEE") {
    statut = "ANNULEE";
  } else if (totalPlanifie <= 0 || totalRestant <= 0) {
    statut = "PAYEE";
  } else if (totalRegle > 0) {
    statut = "PARTIELLE";
  } else if (facture.date_echeance && facture.date_echeance < new Date()) {
    statut = "EN_RETARD";
  }

  await tx.facture.update({
    where: { id: factureId },
    data: { statut },
  });
}

export async function hydratePlanEcheancesFromLegacyJson(
  tx: DbClient,
  planId: string,
  factureId?: string | null,
) {
  const plan = await tx.planPaiementEleve.findUnique({
    where: { id: planId },
    select: {
      id: true,
      eleve_id: true,
      annee_scolaire_id: true,
      plan_json: true,
      echeances: {
        select: { id: true },
      },
    },
  });

  if (!plan || plan.echeances.length > 0) return;

  const basePlan =
    plan.plan_json && typeof plan.plan_json === "object" && !Array.isArray(plan.plan_json)
      ? (plan.plan_json as Record<string, unknown>)
      : {};
  const rawEcheances = Array.isArray(basePlan.echeances)
    ? (basePlan.echeances as Array<Record<string, unknown>>)
    : [];

  if (rawEcheances.length === 0) return;

  const devise = normalizeText(basePlan.devise)?.toUpperCase() ?? "MGA";
  const lines = rawEcheances.map((item, index) => ({
    ordre:
      typeof item.ordre === "number" && Number.isInteger(item.ordre) && item.ordre > 0
        ? item.ordre
        : index + 1,
    date:
      typeof item.date === "string" && item.date.trim()
        ? item.date
        : new Date().toISOString().slice(0, 10),
    montant: toMoney(item.montant),
    statut: normalizeText(item.statut),
    libelle: normalizeText(item.libelle) ?? normalizeText(item.note),
    note: normalizeText(item.note),
    devise,
  }));

  await upsertPlanEcheances(tx, {
    planId: plan.id,
    factureId: factureId ?? normalizeText((basePlan.metadata as Record<string, unknown> | undefined)?.facture_id),
    eleveId: plan.eleve_id,
    anneeScolaireId: plan.annee_scolaire_id,
    devise,
    lines,
  });
}

export async function upsertPlanEcheances(tx: DbClient, args: SyncPlanArgs) {
  const normalized = normalizeEcheanceInputs(args.lines, args.devise);

  const deleteWhere: Prisma.EcheancePaiementWhereInput = args.factureId
    ? {
        OR: [
          { plan_paiement_id: args.planId },
          { facture_id: args.factureId },
        ],
      }
    : { plan_paiement_id: args.planId };

  const toDelete = await tx.echeancePaiement.findMany({
    where: deleteWhere,
    select: { id: true },
  });

  if (toDelete.length > 0) {
    await tx.paiementEcheanceAffectation.deleteMany({
      where: {
        echeance_paiement_id: { in: toDelete.map((item) => item.id) },
      },
    });
  }

  await tx.echeancePaiement.deleteMany({ where: deleteWhere });

  if (normalized.length > 0) {
    await tx.echeancePaiement.createMany({
      data: normalized.map((item) => ({
        plan_paiement_id: args.planId,
        facture_id: args.factureId ?? null,
        eleve_id: args.eleveId,
        annee_scolaire_id: args.anneeScolaireId,
        ordre: item.ordre,
        libelle: item.libelle,
        date_echeance: item.date_echeance,
        montant_prevu: item.montant_prevu,
        montant_regle: 0,
        montant_restant: item.montant_prevu,
        statut: item.statut,
        devise: item.devise,
        notes: item.notes,
      })),
    });
  }

  await syncPlanJsonFromEcheances(tx, args.planId);

  if (args.factureId) {
    await syncFactureStatusFromEcheances(tx, args.factureId);
  }
}

export async function ensureFactureEcheances(tx: DbClient, args: EnsureFactureArgs) {
  const facture = (await tx.facture.findUnique({
    where: { id: args.factureId },
    include: {
      echeances: {
        orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
      },
      paiements: true,
    },
  })) as FactureWithFinanceRelations | null;

  if (!facture) return;

  const activePaiements = getActivePaiements(facture.paiements ?? []);

  if (activePaiements.length > 0 && args.lines) {
    throw new Error("Impossible de reconfigurer les echeances d'une facture deja encaissee.");
  }

  const lines =
    args.lines && args.lines.length > 0
      ? args.lines
      : facture.echeances.length > 0
        ? rebalanceEcheanceLines(
            facture.echeances as EcheanceRecord[],
            toMoney(facture.total_montant),
          )
        : buildDefaultFactureLine(facture);

  const normalized = normalizeEcheanceInputs(lines, facture.devise ?? "MGA");

  const existingIds = facture.echeances.map((item) => item.id);
  if (existingIds.length > 0) {
    await tx.paiementEcheanceAffectation.deleteMany({
      where: {
        echeance_paiement_id: { in: existingIds },
      },
    });
  }

  await tx.echeancePaiement.deleteMany({
    where: { facture_id: facture.id, plan_paiement_id: null },
  });

  const hasPlanLinkedRows = facture.echeances.some((item) => item.plan_paiement_id);
  if (!hasPlanLinkedRows) {
    await tx.echeancePaiement.deleteMany({
      where: { facture_id: facture.id },
    });

    await tx.echeancePaiement.createMany({
      data: normalized.map((item) => ({
        facture_id: facture.id,
        plan_paiement_id: null,
        eleve_id: facture.eleve_id,
        annee_scolaire_id: facture.annee_scolaire_id,
        ordre: item.ordre,
        libelle: item.libelle,
        date_echeance: item.date_echeance,
        montant_prevu: item.montant_prevu,
        montant_regle: 0,
        montant_restant: item.montant_prevu,
        statut: item.statut,
        devise: item.devise,
        notes: item.notes,
      })),
    });
  }

  await syncFactureStatusFromEcheances(tx, facture.id);
}

export async function applyCreditToFactureEcheances(
  tx: DbClient,
  factureId: string,
  creditAmount: number,
) {
  const normalizedCredit = roundMoney(Math.max(0, toMoney(creditAmount)));
  if (normalizedCredit <= 0) return 0;

  const loadFacture = async () =>
    tx.facture.findUnique({
      where: { id: factureId },
      include: {
        echeances: {
          orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
        },
      },
    });

  let facture = await loadFacture();
  if (!facture) return 0;

  if ((facture.echeances?.length ?? 0) === 0) {
    await ensureFactureEcheances(tx, { factureId });
    facture = await loadFacture();
    if (!facture) return 0;
  }

  let remaining = normalizedCredit;
  const touchedPlanIds = new Set<string>();

  for (const echeance of facture.echeances as EcheanceRecord[]) {
    if (remaining <= 0) break;
    if ((echeance.statut ?? "").toUpperCase() === "ANNULEE") continue;

    const montantPrevu = roundMoney(toMoney(echeance.montant_prevu));
    const montantRegle = roundMoney(toMoney(echeance.montant_regle));
    const reducible = roundMoney(Math.max(0, montantPrevu - montantRegle));
    if (reducible <= 0) continue;

    const reduction = roundMoney(Math.min(reducible, remaining));
    const nextMontantPrevu = roundMoney(Math.max(montantRegle, montantPrevu - reduction));
    const nextMontantRestant = roundMoney(Math.max(0, nextMontantPrevu - montantRegle));

    await tx.echeancePaiement.update({
      where: { id: echeance.id },
      data: {
        montant_prevu: nextMontantPrevu,
        montant_restant: nextMontantRestant,
        statut: deriveEcheanceStatus(
          nextMontantPrevu,
          montantRegle,
          echeance.date_echeance,
          echeance.statut,
        ),
      },
    });

    if (echeance.plan_paiement_id) {
      touchedPlanIds.add(echeance.plan_paiement_id);
    }

    remaining = roundMoney(Math.max(0, remaining - reduction));
  }

  for (const planId of touchedPlanIds) {
    await syncPlanJsonFromEcheances(tx, planId);
  }

  await syncFactureStatusFromEcheances(tx, factureId);
  return roundMoney(normalizedCredit - remaining);
}

export async function resolveLinkedFactureIdForPlan(tx: DbClient, planId: string) {
  const existingLinked = await tx.echeancePaiement.findFirst({
    where: {
      plan_paiement_id: planId,
      facture_id: { not: null },
    },
    select: { facture_id: true },
    orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
  });

  if (existingLinked?.facture_id) {
    return existingLinked.facture_id;
  }

  const plan = await tx.planPaiementEleve.findUnique({
    where: { id: planId },
    select: {
      eleve_id: true,
      annee_scolaire_id: true,
      plan_json: true,
    },
  });

  if (!plan) return null;

  const basePlan =
    plan.plan_json && typeof plan.plan_json === "object" && !Array.isArray(plan.plan_json)
      ? (plan.plan_json as Record<string, unknown>)
      : {};
  const metadata =
    basePlan.metadata && typeof basePlan.metadata === "object" && !Array.isArray(basePlan.metadata)
      ? (basePlan.metadata as Record<string, unknown>)
      : {};
  const metadataFactureId = normalizeText(metadata.facture_id);
  if (metadataFactureId) {
    const facture = await tx.facture.findUnique({
      where: { id: metadataFactureId },
      select: { id: true },
    });
    if (facture) return facture.id;
  }

  const factures = await tx.facture.findMany({
    where: {
      eleve_id: plan.eleve_id,
      annee_scolaire_id: plan.annee_scolaire_id,
      statut: { not: "ANNULEE" },
    },
    select: { id: true },
    orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
  });

  if (factures.length === 1) {
    return factures[0].id;
  }

  return null;
}

export async function ensurePlanForFacture(
  tx: DbClient,
  args: {
    factureId: string;
    preferredModePaiement?: string | null;
    preferredPaymentDay?: number | null;
    notes?: string | null;
  },
) {
  const facture = await tx.facture.findUnique({
    where: { id: args.factureId },
    include: {
      echeances: {
        orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
      },
    },
  });

  if (!facture) return null;

  const alreadyLinkedPlanId =
    facture.echeances.find((item) => Boolean(item.plan_paiement_id))?.plan_paiement_id ?? null;

  let plan = alreadyLinkedPlanId
    ? await tx.planPaiementEleve.findUnique({
        where: { id: alreadyLinkedPlanId },
        select: {
          id: true,
          remise_id: true,
          plan_json: true,
          echeances: {
            select: {
              id: true,
              facture_id: true,
              ordre: true,
            },
            orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
          },
        },
      })
    : await tx.planPaiementEleve.findFirst({
        where: {
          eleve_id: facture.eleve_id,
          annee_scolaire_id: facture.annee_scolaire_id,
        },
        select: {
          id: true,
          remise_id: true,
          plan_json: true,
          echeances: {
            select: {
              id: true,
              facture_id: true,
              ordre: true,
            },
            orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
          },
        },
        orderBy: [{ created_at: "asc" }],
      });

  const preferredMode =
    String(
      args.preferredModePaiement ??
        (facture.echeances.length > 1 ? "ECHELONNE" : "COMPTANT"),
    )
      .trim()
      .toUpperCase() === "ECHELONNE"
      ? "ECHELONNE"
      : "COMPTANT";
  const preferredPaymentDay =
    args.preferredPaymentDay == null
      ? facture.echeances[0]
        ? clampPaymentDay(facture.echeances[0].date_echeance.getUTCDate(), 1)
        : null
      : clampPaymentDay(args.preferredPaymentDay, 1);

  if (!plan) {
    plan = await tx.planPaiementEleve.create({
      data: {
        eleve_id: facture.eleve_id,
        annee_scolaire_id: facture.annee_scolaire_id,
        remise_id: facture.remise_id ?? null,
        plan_json: {
          mode_paiement: preferredMode,
          jour_paiement_mensuel:
            preferredMode === "ECHELONNE" ? preferredPaymentDay : null,
          nombre_tranches: facture.echeances.length,
          devise: facture.devise ?? "MGA",
          remise_id: facture.remise_id ?? null,
          notes: normalizeText(args.notes),
          metadata: {
            cree_automatiquement: true,
            origine: "facture",
            facture_id: facture.id,
          },
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        remise_id: true,
        plan_json: true,
        echeances: {
          select: {
            id: true,
            facture_id: true,
            ordre: true,
          },
          orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
        },
      },
    });
  } else if (!plan.remise_id && facture.remise_id) {
    plan = await tx.planPaiementEleve.update({
      where: { id: plan.id },
      data: { remise_id: facture.remise_id },
      select: {
        id: true,
        remise_id: true,
        plan_json: true,
        echeances: {
          select: {
            id: true,
            facture_id: true,
            ordre: true,
          },
          orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
        },
      },
    });
  }

  const currentFactureRows = facture.echeances;
  if (currentFactureRows.length === 0) {
    await syncPlanJsonFromEcheances(tx, plan.id);
    return plan.id;
  }

  const rowsAlreadyLinked =
    currentFactureRows.length > 0 &&
    currentFactureRows.every((item) => item.plan_paiement_id === plan?.id);

  if (!rowsAlreadyLinked) {
    const maxExistingOrdre = (plan.echeances ?? [])
      .filter((item) => item.facture_id !== facture.id)
      .reduce((max, item) => Math.max(max, Number(item.ordre ?? 0)), 0);

    for (const [index, echeance] of currentFactureRows.entries()) {
      await tx.echeancePaiement.update({
        where: { id: echeance.id },
        data: {
          plan_paiement_id: plan.id,
          ordre: maxExistingOrdre + index + 1,
        },
      });
    }
  }

  await syncPlanJsonFromEcheances(tx, plan.id);
  return plan.id;
}

export async function allocatePaiementsToFactureEcheances(
  tx: DbClient,
  factureId: string,
  paymentTargets?: Record<string, string[]>,
) {
  const facture = (await tx.facture.findUnique({
    where: { id: factureId },
    include: {
      paiements: true,
      echeances: {
        orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
      },
    },
  })) as FactureWithFinanceRelations | null;

  if (!facture) return;

  if (facture.echeances.length === 0) {
    await ensureFactureEcheances(tx, { factureId });
  }

  const refreshed = (await tx.facture.findUnique({
    where: { id: factureId },
    include: {
      paiements: true,
      echeances: {
        orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
      },
    },
  })) as FactureWithFinanceRelations | null;

  if (!refreshed || refreshed.echeances.length === 0) {
    await syncFactureStatusFromEcheances(tx, factureId);
    return;
  }

  const activePaiements = getActivePaiements(
    [...(refreshed.paiements ?? [])].sort(
      (left, right) =>
        new Date(left.paye_le).getTime() - new Date(right.paye_le).getTime() ||
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    ),
  );

  const paiementIds = activePaiements.map((item) => item.id);
  const previousAffectations = paiementIds.length
    ? await tx.paiementEcheanceAffectation.findMany({
        where: {
          paiement_id: { in: paiementIds },
        },
        include: {
          echeance: true,
        },
      })
    : [];

  const previousTargetsByPayment = new Map<string, string[]>();
  for (const affectation of previousAffectations) {
    const key = affectation.paiement_id;
    const current = previousTargetsByPayment.get(key) ?? [];
    current.push(affectation.echeance_paiement_id);
    previousTargetsByPayment.set(key, current);
  }

  if (paiementIds.length > 0) {
    await tx.paiementEcheanceAffectation.deleteMany({
      where: {
        paiement_id: { in: paiementIds },
      },
    });
  }

  const localEcheances = refreshed.echeances.map((item) => ({
    id: item.id,
    plan_paiement_id: item.plan_paiement_id,
    ordre: item.ordre,
    date_echeance: item.date_echeance,
    montant_prevu: toMoney(item.montant_prevu),
    montant_regle: 0,
    montant_restant: toMoney(item.montant_prevu),
    devise: item.devise ?? refreshed.devise ?? "MGA",
    libelle: item.libelle,
    notes: item.notes,
    statut: deriveEcheanceStatus(
      toMoney(item.montant_prevu),
      0,
      item.date_echeance,
      item.statut,
    ) as StatutEcheancePaiement,
  }));

  const allocations: Prisma.PaiementEcheanceAffectationCreateManyInput[] = [];

  for (const paiement of activePaiements as Paiement[]) {
    let remaining = toMoney(paiement.montant);
    const preferredIds = paymentTargets?.[paiement.id] ?? previousTargetsByPayment.get(paiement.id) ?? [];
    const orderedEcheances = [
      ...preferredIds
        .map((id) => localEcheances.find((item) => item.id === id))
        .filter((value): value is (typeof localEcheances)[number] => Boolean(value)),
      ...localEcheances.filter((item) => !preferredIds.includes(item.id)),
    ];

    for (const echeance of orderedEcheances) {
      if (remaining <= 0) break;
      if (echeance.montant_restant <= 0) continue;

      const montant = roundMoney(Math.min(remaining, echeance.montant_restant));
      if (montant <= 0) continue;

      echeance.montant_regle = roundMoney(echeance.montant_regle + montant);
      echeance.montant_restant = roundMoney(
        Math.max(0, echeance.montant_prevu - echeance.montant_regle),
      );
      echeance.statut = deriveEcheanceStatus(
        echeance.montant_prevu,
        echeance.montant_regle,
        echeance.date_echeance,
      );
      remaining = roundMoney(Math.max(0, remaining - montant));

      allocations.push({
        paiement_id: paiement.id,
        echeance_paiement_id: echeance.id,
        montant,
      });
    }
  }

  if (allocations.length > 0) {
    await tx.paiementEcheanceAffectation.createMany({ data: allocations });
  }

  for (const echeance of localEcheances) {
    await tx.echeancePaiement.update({
      where: { id: echeance.id },
      data: {
        montant_regle: echeance.montant_regle,
        montant_restant: echeance.montant_restant,
        statut: echeance.statut,
      },
    });
  }

  const planIds = Array.from(
    new Set(
      localEcheances
        .map((item) => item.plan_paiement_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  for (const planId of planIds) {
    await syncPlanJsonFromEcheances(tx, planId);
  }

  await syncFactureStatusFromEcheances(tx, factureId);
}
