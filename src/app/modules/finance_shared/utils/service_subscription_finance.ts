import { Prisma, type PrismaClient } from "@prisma/client";
import {
  allocatePaiementsToFactureEcheances,
  applyCreditToFactureEcheances,
  ensurePlanForFacture,
  ensureFactureEcheances,
  roundMoney,
  syncPlanJsonFromEcheances,
  syncFactureStatusFromEcheances,
  toMoney,
} from "./echeance_paiement";
import { tryApplyAvailableCreditsToFacture } from "./credit_carry_forward";
import { createRecurringExecutionIfNeeded } from "./recurring_billing";

type DbClient = PrismaClient | Prisma.TransactionClient;

type CreateServiceSubscriptionFactureArgs = {
  tenantId: string;
  eleveId: string;
  anneeScolaireId: string;
  catalogueFraisId: string;
  allowedScopes: string[];
  libelle: string;
  modePaiement?: string | null;
  nombreTranches?: number | null;
  jourPaiementMensuel?: number | null;
  createdByUtilisateurId?: string | null;
  dateEmission?: Date | null;
  dateEcheance?: Date | null;
};

type RegularizeServiceSubscriptionFactureArgs = {
  tenantId: string;
  factureId: string;
  eleveId: string;
  anneeScolaireId: string;
  catalogueFraisId: string | null;
  libellePrefix: string;
  serviceLabel: string;
  createdByUtilisateurId?: string | null;
  motif?: string | null;
};

function toDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function clampPaymentDay(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return Math.max(1, Math.min(28, fallback));
  return Math.max(1, Math.min(28, parsed));
}

function normalizeModePaiement(value: unknown) {
  return String(value ?? "COMPTANT").trim().toUpperCase() === "ECHELONNE"
    ? "ECHELONNE"
    : "COMPTANT";
}

function buildMonthlyScheduledDate(year: number, month: number, paymentDay: number) {
  return new Date(Date.UTC(year, month, clampPaymentDay(paymentDay, 1)));
}

function getFirstScheduledPaymentDate(anchorDate: Date, paymentDay: number) {
  const anchor = new Date(anchorDate.toISOString().slice(0, 10));
  let candidate = buildMonthlyScheduledDate(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    paymentDay,
  );

  if (candidate < anchor) {
    candidate = buildMonthlyScheduledDate(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + 1,
      paymentDay,
    );
  }

  return candidate;
}

function hasActivePayments(
  paiements: Array<{
    statut?: string | null;
    montant?: unknown;
  }>,
) {
  return paiements.some((item) => (item.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE");
}

function sumActivePaiements(
  paiements: Array<{
    statut?: string | null;
    montant?: unknown;
  }>,
) {
  return paiements.reduce((sum, item) => {
    if ((item.statut ?? "ENREGISTRE").toUpperCase() !== "ENREGISTRE") return sum;
    return roundMoney(sum + toMoney(item.montant));
  }, 0);
}

async function buildInvoiceNumber(tx: DbClient, tenantId: string, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const count = await tx.facture.count({
    where: {
      etablissement_id: tenantId,
      numero_facture: {
        startsWith: `FAC-${year}-`,
      },
    },
  });
  return `FAC-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function buildCreditNoteNumber(tx: DbClient, tenantId: string, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const count = await tx.facture.count({
    where: {
      etablissement_id: tenantId,
      numero_facture: {
        startsWith: `AV-${year}-`,
      },
    },
  });
  return `AV-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function findReusableFacture(
  tx: DbClient,
  args: {
    tenantId: string;
    eleveId: string;
    anneeScolaireId: string;
    dueDate: Date | null;
    devise: string;
  },
) {
  const candidates = await tx.facture.findMany({
    where: {
      etablissement_id: args.tenantId,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      nature: "FACTURE",
      devise: args.devise,
      NOT: {
        statut: "ANNULEE",
      },
    },
    include: {
      paiements: {
        select: {
          statut: true,
          montant: true,
        },
      },
      echeances: {
        select: {
          id: true,
          ordre: true,
          plan_paiement_id: true,
          date_echeance: true,
          montant_prevu: true,
          libelle: true,
          notes: true,
          devise: true,
          statut: true,
        },
      },
    },
    orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
  });

  return candidates.find((facture) => {
    if (toDateKey(facture.date_echeance) !== toDateKey(args.dueDate)) return false;
    if (hasActivePayments(facture.paiements ?? [])) return false;
    return true;
  });
}

function buildServicePaymentSchedule(args: {
  montant: number;
  modePaiement: string;
  nombreTranches: number;
  dateEmission: Date;
  firstDueDate: Date | null;
  jourPaiementMensuel: number | null;
  libelle: string;
  devise: string;
}) {
  const total = roundMoney(Math.max(0, args.montant));
  if (total <= 0) return [];

  if (args.modePaiement === "COMPTANT") {
    const comptantDate = args.firstDueDate ?? args.dateEmission;
    return [
      {
        ordre: 1,
        date: comptantDate.toISOString().slice(0, 10),
        montant: total,
        statut: "A_VENIR",
        libelle: args.libelle,
        note: "Reglement comptant",
        devise: args.devise,
      },
    ];
  }

  const trancheCount = Math.max(1, Number(args.nombreTranches || 1));
  const anchorDate = args.firstDueDate ?? args.dateEmission;
  const paymentDay = clampPaymentDay(
    args.jourPaiementMensuel,
    anchorDate.getUTCDate(),
  );
  const firstScheduledDate = getFirstScheduledPaymentDate(anchorDate, paymentDay);
  const schedule: Array<{
    ordre: number;
    date: string;
    montant: number;
    statut: string;
    libelle: string;
    note: string;
    devise: string;
  }> = [];

  let remaining = total;
  const baseAmount = roundMoney(total / trancheCount);

  for (let index = 0; index < trancheCount; index += 1) {
    const dueDate = buildMonthlyScheduledDate(
      firstScheduledDate.getUTCFullYear(),
      firstScheduledDate.getUTCMonth() + index,
      paymentDay,
    );
    const montant = index === trancheCount - 1 ? roundMoney(remaining) : baseAmount;
    remaining = roundMoney(Math.max(0, remaining - montant));

    schedule.push({
      ordre: index + 1,
      date: dueDate.toISOString().slice(0, 10),
      montant,
      statut: "A_VENIR",
      libelle: `${args.libelle} - tranche ${index + 1}`,
      note: `${args.libelle} - tranche ${index + 1}/${trancheCount}`,
      devise: args.devise,
    });
  }

  return schedule;
}

export async function createServiceSubscriptionFacture(
  tx: DbClient,
  args: CreateServiceSubscriptionFactureArgs,
) {
  const inscription = await tx.inscription.findUnique({
    where: {
      eleve_id_annee_scolaire_id: {
        eleve_id: args.eleveId,
        annee_scolaire_id: args.anneeScolaireId,
      },
    },
    include: {
      classe: {
        select: { niveau_scolaire_id: true },
      },
    },
  });

  const selectedCatalogue = (await tx.catalogueFrais.findFirst({
    where: {
      id: args.catalogueFraisId,
      etablissement_id: args.tenantId,
    },
    select: {
      id: true,
      nom: true,
      montant: true,
      devise: true,
      niveau_scolaire_id: true,
      usage_scope: true as never,
    },
  })) as {
    id: string;
    nom: string;
    montant: unknown;
    devise: string | null;
    niveau_scolaire_id: string | null;
    usage_scope: string | null;
  } | null;

  if (!selectedCatalogue) {
    throw new Error("Le frais selectionne n'appartient pas a cet etablissement.");
  }

  const usageScope = (selectedCatalogue.usage_scope ?? "GENERAL").toUpperCase();
  if (!args.allowedScopes.includes(usageScope)) {
    throw new Error("Le frais selectionne n'est pas compatible avec ce service.");
  }

  const eleveLevelId = inscription?.classe?.niveau_scolaire_id ?? null;
  if (selectedCatalogue.niveau_scolaire_id && selectedCatalogue.niveau_scolaire_id !== eleveLevelId) {
    throw new Error("Le frais selectionne n'est pas applicable au niveau de l'eleve.");
  }

  const montant = roundMoney(toMoney(selectedCatalogue.montant));
  if (montant < 0) {
    throw new Error("Le montant du frais selectionne est invalide.");
  }

  const devise = (selectedCatalogue.devise ?? "MGA").toUpperCase();
  const dateEmission = args.dateEmission ?? new Date();
  const normalizedModePaiement = normalizeModePaiement(args.modePaiement);
  const dueDate = args.dateEcheance ?? null;
  const paymentSchedule = buildServicePaymentSchedule({
    montant,
    modePaiement: normalizedModePaiement,
    nombreTranches: args.nombreTranches ?? 1,
    dateEmission,
    firstDueDate: dueDate,
    jourPaiementMensuel: args.jourPaiementMensuel ?? null,
    libelle: args.libelle || selectedCatalogue.nom,
    devise,
  });
  const factureDateEcheance =
    paymentSchedule.length > 0
      ? new Date(paymentSchedule[0].date)
      : normalizedModePaiement === "COMPTANT"
        ? dueDate ?? dateEmission
        : dueDate;
  const reusableFacture = await findReusableFacture(tx, {
    tenantId: args.tenantId,
    eleveId: args.eleveId,
    anneeScolaireId: args.anneeScolaireId,
    dueDate: factureDateEcheance,
    devise,
  });

  const facture =
    reusableFacture
      ? reusableFacture
      :
    (await tx.facture.create({
      data: {
        etablissement_id: args.tenantId,
        eleve_id: args.eleveId,
        annee_scolaire_id: args.anneeScolaireId,
        remise_id: null,
        facture_origine_id: null,
        nature: "FACTURE",
        numero_facture: await buildInvoiceNumber(tx, args.tenantId, factureDateEcheance ?? new Date()),
        date_emission: dateEmission,
        date_echeance: factureDateEcheance,
        statut: factureDateEcheance && factureDateEcheance < new Date() ? "EN_RETARD" : "EMISE",
        total_montant: 0,
        devise,
      } as never,
    }));

  await tx.factureLigne.create({
    data: {
      facture_id: facture.id,
      catalogue_frais_id: selectedCatalogue.id,
      libelle: args.libelle || selectedCatalogue.nom,
      quantite: 1,
      prix_unitaire: montant,
      montant,
    } as never,
  });

  const factureWithLines = await tx.facture.findUnique({
    where: { id: facture.id },
    include: {
      lignes: {
        select: {
          montant: true,
        },
      },
    },
  });

  const totalMontant = roundMoney(
    (factureWithLines?.lignes ?? []).reduce((sum, line) => sum + toMoney(line.montant), 0),
  );
  const paymentScheduleForTotal = buildServicePaymentSchedule({
    montant: totalMontant,
    modePaiement: normalizedModePaiement,
    nombreTranches: args.nombreTranches ?? 1,
    dateEmission,
    firstDueDate: dueDate,
    jourPaiementMensuel: args.jourPaiementMensuel ?? null,
    libelle: args.libelle || selectedCatalogue.nom,
    devise,
  });
  const reusedExistingFacture = Boolean(reusableFacture);
  const previousTotalMontant = reusedExistingFacture ? toMoney(reusableFacture?.total_montant) : 0;
  const createdEcheanceIds: string[] = [];

  await tx.facture.update({
    where: { id: facture.id },
    data: {
      total_montant: totalMontant,
      devise,
      date_echeance: factureDateEcheance,
    },
  });

  if (reusedExistingFacture && (reusableFacture?.echeances?.length ?? 0) > 0) {
    const maxExistingOrdre = reusableFacture!.echeances.reduce(
      (max, item) => Math.max(max, Number(item.ordre ?? 0)),
      0,
    );

    for (const [index, line] of paymentSchedule.entries()) {
      const created = await tx.echeancePaiement.create({
        data: {
          plan_paiement_id: null,
          facture_id: facture.id,
          eleve_id: args.eleveId,
          annee_scolaire_id: args.anneeScolaireId,
          ordre: maxExistingOrdre + index + 1,
          libelle: line.libelle,
          date_echeance: new Date(line.date),
          montant_prevu: line.montant,
          montant_regle: 0,
          montant_restant: line.montant,
          statut: new Date(line.date) < new Date() && line.montant > 0 ? "EN_RETARD" : "A_VENIR",
          devise: line.devise,
          notes: line.note,
        },
      });
      createdEcheanceIds.push(created.id);
    }
  } else {
    await ensureFactureEcheances(
      tx,
      paymentScheduleForTotal.length > 0
        ? {
            factureId: facture.id,
            lines: paymentScheduleForTotal,
          }
        : { factureId: facture.id },
    );
  }
  await ensurePlanForFacture(tx, {
    factureId: facture.id,
    preferredModePaiement: normalizedModePaiement,
    preferredPaymentDay: args.jourPaiementMensuel ?? null,
  });
  const autoCredit = await tryApplyAvailableCreditsToFacture(tx, {
    tenantId: args.tenantId,
    factureId: facture.id,
    utilisateurId: args.createdByUtilisateurId ?? null,
    motif: "Report automatique d'un credit disponible sur un service facture.",
  });

  let paiementInitial = null;
  if (normalizedModePaiement === "COMPTANT" && totalMontant > 0) {
    const montantPaiement = reusedExistingFacture
      ? roundMoney(Math.max(0, totalMontant - previousTotalMontant - autoCredit.montant_applique))
      : roundMoney(Math.max(0, totalMontant - autoCredit.montant_applique));
    if (montantPaiement > 0) {
    paiementInitial = await tx.paiement.create({
      data: {
        facture_id: facture.id,
        paye_le: dateEmission,
        montant: montantPaiement,
        methode: "comptant",
        reference: `AUTO-SERVICE-${facture.numero_facture}`,
        recu_par: args.createdByUtilisateurId ?? null,
      } as never,
    });
    await allocatePaiementsToFactureEcheances(
      tx,
      facture.id,
      createdEcheanceIds.length > 0 ? { [paiementInitial.id]: createdEcheanceIds } : undefined,
    );
    }
  }
  await syncFactureStatusFromEcheances(tx, facture.id);

  await createRecurringExecutionIfNeeded(tx as DbClient, {
    tenantId: args.tenantId,
    eleveId: args.eleveId,
    anneeScolaireId: args.anneeScolaireId,
    factureId: facture.id,
    catalogueFraisId: selectedCatalogue.id,
    createdByUtilisateurId: args.createdByUtilisateurId ?? null,
    referenceDate: dateEmission,
  });

  const hydratedFacture = await tx.facture.findUnique({
    where: { id: facture.id },
  });

  return {
    facture: hydratedFacture ?? facture,
    catalogue: selectedCatalogue,
    reused: reusedExistingFacture,
    paiementInitial,
  };
}

export async function regularizeServiceSubscriptionFacture(
  tx: DbClient,
  args: RegularizeServiceSubscriptionFactureArgs,
) {
  const facture = await tx.facture.findFirst({
    where: {
      id: args.factureId,
      etablissement_id: args.tenantId,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
    },
    include: {
      lignes: true,
      paiements: {
        select: {
          statut: true,
          montant: true,
        },
      },
      echeances: {
        select: {
          montant_restant: true,
        },
      },
    },
  });

  if (!facture) {
    throw new Error("La facture liee au service est introuvable.");
  }

  if ((facture.nature ?? "FACTURE").toUpperCase() !== "FACTURE") {
    throw new Error("La regularisation ne peut s'appliquer que sur une facture standard.");
  }

  if ((facture.statut ?? "").toUpperCase() === "ANNULEE") {
    return {
      facture,
      avoir: null,
      montant_regularise: 0,
      montant_applique: 0,
    };
  }

  const candidateLines = facture.lignes.filter((line) => {
    const sameCatalogue =
      args.catalogueFraisId != null && line.catalogue_frais_id === args.catalogueFraisId;
    const matchingLabel = (line.libelle ?? "").toLowerCase().startsWith(args.libellePrefix.toLowerCase());
    if (args.catalogueFraisId) return sameCatalogue && matchingLabel;
    return matchingLabel;
  });

  const fallbackLines =
    candidateLines.length > 0
      ? candidateLines
      : facture.lignes.filter((line) => {
          if (!args.catalogueFraisId) return false;
          return line.catalogue_frais_id === args.catalogueFraisId;
        });

  const targetLines = fallbackLines.filter((line) => toMoney(line.montant) > 0);
  const requestedAmount = roundMoney(
    targetLines.reduce((sum, line) => sum + toMoney(line.montant), 0),
  );

  if (requestedAmount <= 0) {
    return {
      facture,
      avoir: null,
      montant_regularise: 0,
      montant_applique: 0,
    };
  }

  const outstandingAmount =
    facture.echeances.length > 0
      ? roundMoney(
          facture.echeances.reduce((sum, item) => sum + toMoney(item.montant_restant), 0),
        )
      : roundMoney(Math.max(0, toMoney(facture.total_montant) - sumActivePaiements(facture.paiements ?? [])));
  const compensationAmount = roundMoney(Math.min(requestedAmount, outstandingAmount));

  const avoir = await tx.facture.create({
    data: {
      etablissement_id: args.tenantId,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      remise_id: null,
      facture_origine_id: facture.id,
      nature: "AVOIR",
      numero_facture: await buildCreditNoteNumber(tx, args.tenantId),
      date_emission: new Date(),
      date_echeance: new Date(),
      statut: "PAYEE",
      total_montant: -Math.abs(requestedAmount),
      devise: facture.devise ?? "MGA",
    } as never,
  });

  await tx.factureLigne.create({
    data: {
      facture_id: avoir.id,
      catalogue_frais_id: null,
      libelle: `Avoir ${args.serviceLabel} pour ${facture.numero_facture}`,
      quantite: 1,
      prix_unitaire: -Math.abs(requestedAmount),
      montant: -Math.abs(requestedAmount),
    } as never,
  });

  if (compensationAmount > 0) {
    await applyCreditToFactureEcheances(tx, facture.id, compensationAmount);
  }

  await tx.operationFinanciere.create({
    data: {
      etablissement_id: args.tenantId,
      facture_id: facture.id,
      cree_par_utilisateur_id: args.createdByUtilisateurId ?? null,
      type: "REGULARISATION_SERVICE",
      montant: requestedAmount,
      motif: args.motif ?? `${args.serviceLabel} resilie`,
      details_json: {
        facture_avoir_id: avoir.id,
        numero_avoir: avoir.numero_facture,
        service: args.serviceLabel,
        montant_applique: compensationAmount,
        montant_non_affecte: roundMoney(Math.max(0, requestedAmount - compensationAmount)),
      },
    } as never,
  });

  return {
    facture,
    avoir,
    montant_regularise: requestedAmount,
    montant_applique: compensationAmount,
  };
}
