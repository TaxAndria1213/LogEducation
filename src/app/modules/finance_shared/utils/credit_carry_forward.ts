import { Prisma, type PrismaClient } from "@prisma/client";
import { applyCreditToFactureEcheances, roundMoney, toMoney } from "./echeance_paiement";

type DbClient = PrismaClient | Prisma.TransactionClient;

type CreditSource = {
  operationId: string;
  sourceType: "AVOIR_FACTURE" | "TROP_PERCU";
  factureAvoirId: string;
  paiementId: string | null;
  numeroAvoir: string | null;
  numeroRecu: string | null;
  montantDisponible: number;
};

function readDetailsObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNumber(details: Record<string, unknown> | null, key: string) {
  if (!details) return 0;
  return toMoney(details[key]);
}

function readText(details: Record<string, unknown> | null, key: string) {
  if (!details) return null;
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listAvailableCarryForwardCredits(
  tx: DbClient,
  args: {
    tenantId: string;
    eleveId: string;
    devise: string;
  },
) {
  const creditOperations = await tx.operationFinanciere.findMany({
    where: {
      etablissement_id: args.tenantId,
      type: { in: ["AVOIR_FACTURE", "TROP_PERCU"] },
      OR: [
        {
          facture: {
            is: {
              eleve_id: args.eleveId,
              devise: args.devise,
            },
          },
        },
        {
          paiement: {
            is: {
              facture: {
                is: {
                  eleve_id: args.eleveId,
                  devise: args.devise,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      type: true,
      paiement_id: true,
      details_json: true,
    },
    orderBy: [{ created_at: "asc" }],
  });

  const usageOperations = await tx.operationFinanciere.findMany({
    where: {
      etablissement_id: args.tenantId,
      type: { in: ["REPORT_SOLDE_PERIODE", "REMBOURSEMENT_TROP_PERCU"] },
    },
    select: {
      type: true,
      paiement_id: true,
      details_json: true,
    },
  });

  const usedByAvoirId = new Map<string, number>();
  const usedByPaiementId = new Map<string, number>();
  const refundedByPaiementId = new Map<string, number>();
  for (const operation of usageOperations) {
    const details = readDetailsObject(operation.details_json);
    if ((operation.type ?? "").toUpperCase() === "REMBOURSEMENT_TROP_PERCU") {
      const sourcePaiementId =
        operation.paiement_id ??
        readText(details, "source_paiement_id");
      const refundedAmount = readNumber(details, "montant_rembourse") || readNumber(details, "montant_source_utilise");
      if (sourcePaiementId) {
        refundedByPaiementId.set(
          sourcePaiementId,
          roundMoney((refundedByPaiementId.get(sourcePaiementId) ?? 0) + refundedAmount),
        );
      }
      continue;
    }
    const sourceFactureAvoirId = readText(details, "source_facture_avoir_id");
    const sourcePaiementId = readText(details, "source_paiement_id");
    const usedAmount = readNumber(details, "montant_source_utilise");
    if (sourceFactureAvoirId) {
      usedByAvoirId.set(
        sourceFactureAvoirId,
        roundMoney((usedByAvoirId.get(sourceFactureAvoirId) ?? 0) + usedAmount),
      );
    }
    if (sourcePaiementId) {
      usedByPaiementId.set(
        sourcePaiementId,
        roundMoney((usedByPaiementId.get(sourcePaiementId) ?? 0) + usedAmount),
      );
    }
  }

  const sources: CreditSource[] = [];
  for (const operation of creditOperations) {
    const details = readDetailsObject(operation.details_json);
    const isOverpayment = operation.type === "TROP_PERCU";
    const factureAvoirId = isOverpayment
      ? "__TROP_PERCU__"
      : readText(details, "facture_avoir_id");
    if (!factureAvoirId) continue;

    const initialAvailable = isOverpayment
      ? readNumber(details, "montant_disponible")
      : readNumber(details, "montant_non_affecte");
    if (initialAvailable <= 0) continue;

    const alreadyUsed = isOverpayment
      ? roundMoney(
          (operation.paiement_id ? usedByPaiementId.get(operation.paiement_id) ?? 0 : 0) +
            (operation.paiement_id ? refundedByPaiementId.get(operation.paiement_id) ?? 0 : 0),
        )
      : usedByAvoirId.get(factureAvoirId) ?? 0;
    const montantDisponible = roundMoney(Math.max(0, initialAvailable - alreadyUsed));
    if (montantDisponible <= 0) continue;

    sources.push({
      operationId: operation.id,
      sourceType: isOverpayment ? "TROP_PERCU" : "AVOIR_FACTURE",
      factureAvoirId,
      paiementId: operation.paiement_id ?? null,
      numeroAvoir: readText(details, "numero_avoir"),
      numeroRecu: readText(details, "numero_recu"),
      montantDisponible,
    });
  }

  return sources;
}

export async function applyAvailableCreditsToFacture(
  tx: DbClient,
  args: {
    tenantId: string;
    factureId: string;
    utilisateurId?: string | null;
    motif?: string | null;
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

  if (!facture) {
    throw new Error("Facture introuvable pour l'application du credit.");
  }

  const remaining = roundMoney(
    (facture.echeances ?? []).reduce(
      (sum, item) =>
        sum +
        (((item.statut ?? "").toUpperCase() === "ANNULEE"
          ? 0
          : Math.max(0, toMoney(item.montant_restant))) ?? 0),
      0,
    ),
  );

  if (remaining <= 0) {
    throw new Error("Cette facture ne presente aucun solde restant a couvrir.");
  }

  const sources = await listAvailableCarryForwardCredits(tx, {
    tenantId: args.tenantId,
    eleveId: facture.eleve_id,
    devise: facture.devise ?? "MGA",
  });

  if (sources.length === 0) {
    throw new Error("Aucun avoir disponible n'est a reporter pour cet eleve.");
  }

  let outstanding = remaining;
  let appliedTotal = 0;
  const usages: Array<{
    factureAvoirId: string;
    paiementId: string | null;
    numeroAvoir: string | null;
    numeroRecu: string | null;
    montant: number;
  }> = [];

  for (const source of sources) {
    if (outstanding <= 0) break;

    const requested = roundMoney(Math.min(outstanding, source.montantDisponible));
    if (requested <= 0) continue;

    const applied = await applyCreditToFactureEcheances(tx, facture.id, requested);
    if (applied <= 0) continue;

    await tx.operationFinanciere.create({
      data: {
        etablissement_id: args.tenantId,
        facture_id: facture.id,
        cree_par_utilisateur_id: args.utilisateurId ?? null,
        type: "REPORT_SOLDE_PERIODE",
        montant: applied,
        motif: args.motif ?? null,
        details_json: {
          source_facture_avoir_id: source.factureAvoirId,
          source_paiement_id: source.paiementId,
          source_operation_id: source.operationId,
          numero_avoir: source.numeroAvoir,
          numero_recu: source.numeroRecu,
          montant_source_utilise: applied,
        },
      },
    });

    usages.push({
      factureAvoirId: source.factureAvoirId,
      paiementId: source.paiementId,
      numeroAvoir: source.numeroAvoir,
      numeroRecu: source.numeroRecu,
      montant: applied,
    });
    appliedTotal = roundMoney(appliedTotal + applied);
    outstanding = roundMoney(Math.max(0, outstanding - applied));
  }

  if (appliedTotal <= 0) {
    throw new Error("Aucun credit disponible n'a pu etre applique a cette facture.");
  }

  return {
    montant_applique: appliedTotal,
    usages,
  };
}

export async function tryApplyAvailableCreditsToFacture(
  tx: DbClient,
  args: {
    tenantId: string;
    factureId: string;
    utilisateurId?: string | null;
    motif?: string | null;
  },
) {
  try {
    return await applyAvailableCreditsToFacture(tx, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message === "Aucun avoir disponible n'est a reporter pour cet eleve." ||
      message === "Cette facture ne presente aucun solde restant a couvrir."
    ) {
      return {
        montant_applique: 0,
        usages: [],
      };
    }
    throw error;
  }
}
