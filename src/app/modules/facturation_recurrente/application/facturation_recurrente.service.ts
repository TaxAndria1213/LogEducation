import { randomUUID } from "crypto";
import { PrismaClient, type StatutFacture } from "@prisma/client";
import { prisma as sharedPrisma } from "../../../service/prisma";
import {
  ensurePlanForFacture,
  ensureFactureEcheances,
  roundMoney,
  syncFactureStatusFromEcheances,
} from "../../finance_shared/utils/echeance_paiement";
import { tryApplyAvailableCreditsToFacture } from "../../finance_shared/utils/credit_carry_forward";
import {
  assessBillingReadiness,
  type BillingReadinessIssue,
} from "../../finance_shared/utils/billing_readiness";

export type FacturationRecurrentePayload = {
  annee_scolaire_id: string | null;
  catalogue_frais_id: string | null;
  periodicite: string | null;
  niveau_scolaire_id: string | null;
  date_reference: Date;
  date_echeance: Date | null;
};

export type FacturationReadinessIssue = BillingReadinessIssue;

type CycleInfo = {
  periodicite: string;
  cycleKey: string;
  cycleLabel: string;
};

type InvoiceSummary = {
  facture_id: string;
  numero_facture: string;
  eleve_id: string;
  eleve_label: string;
  periodicite: string;
  cycle_key: string;
  cycle_label: string;
  date_echeance: string;
  devise: string;
  total_montant: number;
  catalogues: Array<{
    id: string;
    nom: string;
    count: number;
  }>;
};

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function toDateOnly(value: Date) {
  return new Date(value.toISOString().slice(0, 10));
}

function toMonthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function toDateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function clampPaymentDay(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return Math.max(1, Math.min(28, fallback));
  return Math.max(1, Math.min(28, parsed));
}

function buildMonthlyScheduledDate(referenceDate: Date, paymentDay: number) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), clampPaymentDay(paymentDay, 1)));
}

function getIsoWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    year: utcDate.getUTCFullYear(),
    week: weekNo,
  };
}

export class FacturationRecurrenteService {
  private prisma: PrismaClient;

  constructor(prisma = sharedPrisma) {
    this.prisma = prisma;
  }

  public parseDate(value: unknown, fallback?: Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (fallback) return fallback;
    throw new Error("La date fournie est invalide.");
  }

  public normalizePayload(raw: Record<string, unknown>): FacturationRecurrentePayload {
    return {
      annee_scolaire_id:
        typeof raw.annee_scolaire_id === "string" && raw.annee_scolaire_id.trim()
          ? raw.annee_scolaire_id.trim()
          : null,
      catalogue_frais_id:
        typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
          ? raw.catalogue_frais_id.trim()
          : null,
      periodicite:
        typeof raw.periodicite === "string" && raw.periodicite.trim()
          ? raw.periodicite.trim().toLowerCase()
          : null,
      niveau_scolaire_id:
        typeof raw.niveau_scolaire_id === "string" && raw.niveau_scolaire_id.trim()
          ? raw.niveau_scolaire_id.trim()
          : null,
      date_reference: toDateOnly(this.parseDate(raw.date_reference ?? new Date())),
      date_echeance:
        raw.date_echeance === null || raw.date_echeance === ""
          ? null
          : raw.date_echeance
            ? toDateOnly(this.parseDate(raw.date_echeance))
            : null,
    };
  }

  public async getReadiness(
    tenantId: string,
    args: { annee_scolaire_id?: string | null; date_reference?: Date | null } = {},
  ) {
    return assessBillingReadiness(this.prisma, {
      tenantId,
      anneeScolaireId: args.annee_scolaire_id ?? null,
      referenceDate: args.date_reference ?? new Date(),
      requireApprovedRecurring: true,
      requireActiveInscriptions: true,
    });
  }

  private isInscriptionEligibleForCatalogue(
    inscription: {
      eleve_id: string;
      classe?: { id?: string | null; niveau_scolaire_id?: string | null } | null;
    },
    catalogue: {
      niveau_scolaire_id?: string | null;
      eligibilite_json?: unknown;
    },
    payload: FacturationRecurrentePayload,
  ) {
    if (payload.niveau_scolaire_id && inscription.classe?.niveau_scolaire_id !== payload.niveau_scolaire_id) {
      return false;
    }

    if (catalogue.niveau_scolaire_id && inscription.classe?.niveau_scolaire_id !== catalogue.niveau_scolaire_id) {
      return false;
    }

    const rules =
      catalogue.eligibilite_json && typeof catalogue.eligibilite_json === "object" && !Array.isArray(catalogue.eligibilite_json)
        ? (catalogue.eligibilite_json as Record<string, unknown>)
        : null;
    const allowedClasses = Array.isArray(rules?.classe_ids)
      ? rules.classe_ids.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
      : [];
    const allowedEleves = Array.isArray(rules?.eleve_ids)
      ? rules.eleve_ids.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
      : [];

    if (allowedClasses.length > 0 && (!inscription.classe?.id || !allowedClasses.includes(inscription.classe.id))) {
      return false;
    }

    if (allowedEleves.length > 0 && !allowedEleves.includes(inscription.eleve_id)) {
      return false;
    }

    return true;
  }

  private async buildInvoiceNumber(
    tx: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    tenantId: string,
    runningIndex: number,
    referenceDate = new Date(),
  ) {
    const year = referenceDate.getUTCFullYear();
    const count = await tx.facture.count({
      where: {
        etablissement_id: tenantId,
        numero_facture: {
          startsWith: `FAC-${year}-`,
        },
      },
    });
    return `FAC-${year}-${String(count + runningIndex).padStart(4, "0")}`;
  }

  private buildInvoiceGroupKey(args: {
    eleveId: string;
    anneeScolaireId: string;
    periodicite: string;
    cycleKey: string;
    dueDate: Date;
    devise: string;
  }) {
    return [
      args.eleveId,
      args.anneeScolaireId,
      args.periodicite,
      args.cycleKey,
      toDateKey(args.dueDate),
      args.devise.toUpperCase(),
    ].join("::");
  }

  private async resolveAnneeScolaire(
    tenantId: string,
    anneeId: string | null,
    referenceDate: Date,
  ) {
    if (anneeId) {
      const annee = await this.prisma.anneeScolaire.findFirst({
        where: {
          id: anneeId,
          etablissement_id: tenantId,
        },
      });

      if (!annee) {
        throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
      }

      return annee;
    }

    const activeYear = await this.prisma.anneeScolaire.findFirst({
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
    });

    if (!activeYear) {
      throw new Error("Aucune annee scolaire active ou correspondante a la date n'a ete trouvee.");
    }

    return activeYear;
  }

  private async resolveCycleInfo(periodicite: string, anneeId: string, referenceDate: Date): Promise<CycleInfo> {
    switch (periodicite) {
      case "daily":
        return {
          periodicite,
          cycleKey: referenceDate.toISOString().slice(0, 10),
          cycleLabel: formatDateLabel(referenceDate),
        };
      case "weekly": {
        const isoWeek = getIsoWeek(referenceDate);
        return {
          periodicite,
          cycleKey: `${isoWeek.year}-W${String(isoWeek.week).padStart(2, "0")}`,
          cycleLabel: `Semaine ${isoWeek.week} - ${isoWeek.year}`,
        };
      }
      case "monthly":
        return {
          periodicite,
          cycleKey: referenceDate.toISOString().slice(0, 7),
          cycleLabel: referenceDate.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          }),
        };
      case "year":
        return {
          periodicite,
          cycleKey: `YEAR:${anneeId}`,
          cycleLabel: `Annee scolaire ${anneeId}`,
        };
      case "term": {
        const periode = await this.prisma.periode.findFirst({
          where: {
            annee_scolaire_id: anneeId,
            date_debut: { lte: referenceDate },
            date_fin: { gte: referenceDate },
          },
          orderBy: [{ ordre: "asc" }],
        });

        if (!periode) {
          throw new Error("Impossible de trouver une periode couvrant la date de reference pour un frais trimestriel.");
        }

        return {
          periodicite,
          cycleKey: `TERM:${periode.id}`,
          cycleLabel: periode.nom,
        };
      }
      case "semester": {
        const annee = await this.prisma.anneeScolaire.findUnique({
          where: { id: anneeId },
          select: { nom: true, date_debut: true },
        });
        if (!annee) {
          throw new Error("Impossible de trouver l'annee scolaire pour un frais semestriel.");
        }
        const start = toDateOnly(referenceDate);
        const yearStart = toDateOnly(this.parseDate(annee.date_debut ?? referenceDate, referenceDate));
        const monthsDiff =
          (start.getUTCFullYear() - yearStart.getUTCFullYear()) * 12 +
          (start.getUTCMonth() - yearStart.getUTCMonth());
        const semesterIndex = monthsDiff >= 6 ? 2 : 1;
        return {
          periodicite,
          cycleKey: `SEMESTER:${anneeId}:${semesterIndex}`,
          cycleLabel: `Semestre ${semesterIndex} - ${annee.nom}`,
        };
      }
      default:
        throw new Error(`La periodicite ${periodicite} n'est pas prise en charge pour la generation recurrente.`);
    }
  }

  private deriveFactureStatus(dueDate: Date | null): StatutFacture {
    if (dueDate && dueDate < new Date()) return "EN_RETARD";
    return "EMISE";
  }

  private extractMonthlyPaymentDay(planJson: unknown) {
    if (!planJson || typeof planJson !== "object") return null;
    const raw = planJson as Record<string, unknown>;
    if ("jour_paiement_mensuel" in raw) {
      return clampPaymentDay(raw.jour_paiement_mensuel, 1);
    }
    if (
      "finance" in raw &&
      raw.finance &&
      typeof raw.finance === "object" &&
      "jour_paiement_mensuel" in (raw.finance as Record<string, unknown>)
    ) {
      return clampPaymentDay((raw.finance as Record<string, unknown>).jour_paiement_mensuel, 1);
    }
    return null;
  }

  private async notifyFamilyForGeneratedInvoice(
    tx: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    args: {
      tenantId: string;
      factureId: string;
      eleveId: string;
      numeroFacture: string;
      totalMontant: number;
      devise: string;
      dueDate: string;
    },
  ) {
    const parentLinks = await tx.eleveParentTuteur.findMany({
      where: {
        eleve_id: args.eleveId,
        parent_tuteur: {
          etablissement_id: args.tenantId,
        },
      },
      select: {
        parent_tuteur: {
          select: {
            utilisateur_id: true,
          },
        },
      },
    });

    const recipientIds = Array.from(
      new Set(
        parentLinks
          .map((item) => item.parent_tuteur?.utilisateur_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (recipientIds.length === 0) return;

    await tx.notification.createMany({
      data: recipientIds.map((utilisateur_id) => ({
        utilisateur_id,
        type: "FACTURE_EMISE",
        payload_json: {
          facture_id: args.factureId,
          eleve_id: args.eleveId,
          numero_facture: args.numeroFacture,
          total_montant: args.totalMontant,
          devise: args.devise,
          date_echeance: args.dueDate,
          source: "FACTURATION_RECURRENTE",
        } as any,
      })),
    });
  }

  public async generateForTenant(
    tenantId: string,
    senderId: string | null,
    payload: FacturationRecurrentePayload,
  ) {
    const readiness = await this.getReadiness(tenantId, {
      annee_scolaire_id: payload.annee_scolaire_id,
      date_reference: payload.date_reference,
    });
    if (!readiness.ready) {
      const blocking = readiness.issues.filter((item) => item.severity === "error");
      throw new Error(blocking.map((item) => item.message).join(" "));
    }

    const annee = await this.resolveAnneeScolaire(tenantId, payload.annee_scolaire_id, payload.date_reference);
    const runId = randomUUID();

    const catalogues = await this.prisma.catalogueFrais.findMany({
      where: {
        etablissement_id: tenantId,
        est_recurrent: true,
        statut_validation: "APPROUVEE",
        ...(payload.catalogue_frais_id ? { id: payload.catalogue_frais_id } : {}),
        ...(payload.periodicite ? { periodicite: payload.periodicite } : {}),
        ...(payload.niveau_scolaire_id ? { niveau_scolaire_id: payload.niveau_scolaire_id } : {}),
      } as never,
      include: {
        niveau: true,
      } as never,
      orderBy: [{ nom: "asc" }],
    });

    if (catalogues.length === 0) {
      throw new Error("Aucun frais recurrent ne correspond a la selection.");
    }

    const inscriptions = await this.prisma.inscription.findMany({
      where: {
        annee_scolaire_id: annee.id,
        statut: "INSCRIT",
        classe: {
          etablissement_id: tenantId,
        },
      },
      include: {
        classe: {
          select: {
            id: true,
            nom: true,
            niveau_scolaire_id: true,
          },
        },
        eleve: {
          include: {
            utilisateur: {
              include: {
                profil: true,
              },
            },
          },
        },
      },
    });

    const paymentDayPlans = await this.prisma.planPaiementEleve.findMany({
      where: {
        annee_scolaire_id: annee.id,
        eleve_id: { in: inscriptions.map((item) => item.eleve_id) },
      },
      select: {
        eleve_id: true,
        plan_json: true,
      },
    });
    const paymentDayByEleve = new Map(
      paymentDayPlans
        .map((item) => [item.eleve_id, this.extractMonthlyPaymentDay(item.plan_json)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] != null),
    );

    if (inscriptions.length === 0) {
      throw new Error("Aucune inscription active n'a ete trouvee pour l'annee selectionnee.");
    }

    const inscriptionByEleveId = new Map(inscriptions.map((item) => [item.eleve_id, item] as const));
    const activeTransportSubscriptions = await this.prisma.abonnementTransport.findMany({
      where: {
        annee_scolaire_id: annee.id,
        eleve: {
          etablissement_id: tenantId,
        },
      },
      include: {
        ligne: {
          select: {
            catalogue_frais_id: true,
            nom: true,
          },
        },
        eleve: {
          include: {
            utilisateur: {
              include: {
                profil: true,
              },
            },
          },
        },
      },
    });
    const activeCantineSubscriptions = await this.prisma.abonnementCantine.findMany({
      where: {
        annee_scolaire_id: annee.id,
        eleve: {
          etablissement_id: tenantId,
        },
      },
      include: {
        formule: {
          select: {
            catalogue_frais_id: true,
            nom: true,
          },
        },
        eleve: {
          include: {
            utilisateur: {
              include: {
                profil: true,
              },
            },
          },
        },
      },
    });

    const createdSummaries = new Map<string, InvoiceSummary>();
    const skipped: Array<Record<string, unknown>> = [];
    let invoiceIndex = 1;

    await this.prisma.$transaction(async (tx) => {
      const invoiceCache = new Map<
        string,
        {
          facture_id: string;
          numero_facture: string;
          eleve_id: string;
          eleve_label: string;
          periodicite: string;
          cycle_key: string;
          cycle_label: string;
          date_echeance: string;
          devise: string;
          total_montant: number;
          catalogues: Map<string, { id: string; nom: string; count: number }>;
        }
      >();

      for (const catalogue of catalogues) {
        const cycle = await this.resolveCycleInfo(
          catalogue.periodicite ?? "",
          annee.id,
          payload.date_reference,
        );

        const usageScope = (catalogue.usage_scope ?? "GENERAL").toUpperCase();
        const eligibleInscriptions =
          usageScope === "TRANSPORT"
            ? Array.from(
                new Map(
                  activeTransportSubscriptions
                    .filter((subscription) => {
                      const statut = (subscription.statut ?? "ACTIF").toUpperCase();
                      if (["RESILIE", "ANNULE", "INACTIF"].includes(statut)) return false;
                      if (subscription.ligne?.catalogue_frais_id !== catalogue.id) return false;
                      const inscription = inscriptionByEleveId.get(subscription.eleve_id);
                      if (!inscription) return false;
                      return this.isInscriptionEligibleForCatalogue(inscription, catalogue, payload);
                    })
                    .map((subscription) => [
                      subscription.eleve_id,
                      inscriptionByEleveId.get(subscription.eleve_id),
                    ] as const)
                    .filter((entry): entry is readonly [string, (typeof inscriptions)[number]] => Boolean(entry[1])),
                ).values(),
              )
            : usageScope === "CANTINE"
              ? Array.from(
                  new Map(
                    activeCantineSubscriptions
                      .filter((subscription) => {
                        const statut = (subscription.statut ?? "ACTIF").toUpperCase();
                        if (["RESILIE", "ANNULE", "INACTIF"].includes(statut)) return false;
                        if (subscription.formule?.catalogue_frais_id !== catalogue.id) return false;
                        const inscription = inscriptionByEleveId.get(subscription.eleve_id);
                        if (!inscription) return false;
                        return this.isInscriptionEligibleForCatalogue(inscription, catalogue, payload);
                      })
                      .map((subscription) => [
                        subscription.eleve_id,
                        inscriptionByEleveId.get(subscription.eleve_id),
                      ] as const)
                      .filter((entry): entry is readonly [string, (typeof inscriptions)[number]] => Boolean(entry[1])),
                  ).values(),
                )
              : inscriptions.filter((inscription) => {
                  return this.isInscriptionEligibleForCatalogue(inscription, catalogue, payload);
                });

        for (const inscription of eligibleInscriptions) {
          const existingExecution = await tx.facturationRecurrenteExecution.findFirst({
            where: {
              catalogue_frais_id: catalogue.id,
              eleve_id: inscription.eleve_id,
              annee_scolaire_id: annee.id,
              cycle_key: cycle.cycleKey,
            },
            select: { id: true },
          });

          if (existingExecution) {
            skipped.push({
              catalogue_frais_id: catalogue.id,
              eleve_id: inscription.eleve_id,
              cycle_key: cycle.cycleKey,
              reason: "Facturation deja generee pour ce cycle.",
            });
            continue;
          }

          const dueDate =
            payload.date_echeance ??
            (cycle.periodicite === "monthly"
              ? buildMonthlyScheduledDate(
                  payload.date_reference,
                  paymentDayByEleve.get(inscription.eleve_id) ?? payload.date_reference.getUTCDate(),
                )
              : payload.date_reference);
          const label = `${catalogue.nom} - ${cycle.cycleLabel}`;
          const devise = (catalogue.devise ?? "MGA").toUpperCase();
          const amount = Number(catalogue.montant);
          const groupKey = this.buildInvoiceGroupKey({
            eleveId: inscription.eleve_id,
            anneeScolaireId: annee.id,
            periodicite: cycle.periodicite,
            cycleKey: cycle.cycleKey,
            dueDate,
            devise,
          });

          let invoiceEntry = invoiceCache.get(groupKey);

          if (!invoiceEntry) {
            const reusableExecutions = await tx.facturationRecurrenteExecution.findMany({
              where: {
                etablissement_id: tenantId,
                eleve_id: inscription.eleve_id,
                annee_scolaire_id: annee.id,
                periodicite: cycle.periodicite,
                cycle_key: cycle.cycleKey,
              },
              include: {
                facture: {
                  include: {
                    paiements: true,
                    echeances: {
                      select: {
                        plan_paiement_id: true,
                      },
                    },
                  },
                },
              },
              orderBy: [{ created_at: "asc" }],
            });

            const reusableFacture = reusableExecutions
              .map((item) => item.facture)
              .find((facture) => {
                if (!facture) return false;
                if ((facture.nature ?? "FACTURE").toUpperCase() !== "FACTURE") return false;
                if ((facture.statut ?? "").toUpperCase() === "ANNULEE") return false;
                if (toDateKey(facture.date_echeance ?? facture.date_emission) !== toDateKey(dueDate)) return false;
                if ((facture.devise ?? "MGA").toUpperCase() !== devise) return false;
                const hasActivePayments = (facture.paiements ?? []).some(
                  (paiement) => (paiement.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
                );
                if (hasActivePayments) return false;
                const hasPlanLinkedEcheances = (facture.echeances ?? []).some((item) => Boolean(item.plan_paiement_id));
                return !hasPlanLinkedEcheances;
              });

            if (reusableFacture) {
              invoiceEntry = {
                facture_id: reusableFacture.id,
                numero_facture: reusableFacture.numero_facture,
                eleve_id: inscription.eleve_id,
                eleve_label:
                  [inscription.eleve?.utilisateur?.profil?.prenom, inscription.eleve?.utilisateur?.profil?.nom]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  inscription.eleve?.code_eleve ||
                  inscription.eleve_id,
                periodicite: cycle.periodicite,
                cycle_key: cycle.cycleKey,
                cycle_label: cycle.cycleLabel,
                date_echeance: toDateKey(dueDate),
                devise,
                total_montant: Number(reusableFacture.total_montant ?? 0),
                catalogues: new Map(),
              };
            } else {
              const invoiceNumber = await this.buildInvoiceNumber(
                tx as any,
                tenantId,
                invoiceIndex,
                payload.date_reference,
              );
              invoiceIndex += 1;

              const facture = await tx.facture.create({
                data: {
                  etablissement_id: tenantId,
                  eleve_id: inscription.eleve_id,
                  annee_scolaire_id: annee.id,
                  remise_id: null,
                  numero_facture: invoiceNumber,
                  date_emission: payload.date_reference,
                  date_echeance: dueDate,
                  statut: this.deriveFactureStatus(dueDate),
                  total_montant: 0,
                  devise,
                },
              });

              invoiceEntry = {
                facture_id: facture.id,
                numero_facture: facture.numero_facture,
                eleve_id: inscription.eleve_id,
                eleve_label:
                  [inscription.eleve?.utilisateur?.profil?.prenom, inscription.eleve?.utilisateur?.profil?.nom]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  inscription.eleve?.code_eleve ||
                  inscription.eleve_id,
                periodicite: cycle.periodicite,
                cycle_key: cycle.cycleKey,
                cycle_label: cycle.cycleLabel,
                date_echeance: toDateKey(dueDate),
                devise,
                total_montant: 0,
                catalogues: new Map(),
              };
            }

            invoiceCache.set(groupKey, invoiceEntry);
          }

          await tx.factureLigne.create({
            data: {
              facture_id: invoiceEntry.facture_id,
              catalogue_frais_id: catalogue.id,
              libelle: label,
              quantite: 1,
              prix_unitaire: catalogue.montant,
              montant: catalogue.montant,
            },
          });

          invoiceEntry.total_montant = Number(
            roundMoney(invoiceEntry.total_montant + amount),
          );

          await tx.facture.update({
            where: { id: invoiceEntry.facture_id },
            data: {
              total_montant: invoiceEntry.total_montant,
              date_echeance: dueDate,
              devise,
            },
          });

          const summaryCatalogue = invoiceEntry.catalogues.get(catalogue.id) ?? {
            id: catalogue.id,
            nom: catalogue.nom,
            count: 0,
          };
          summaryCatalogue.count += 1;
          invoiceEntry.catalogues.set(catalogue.id, summaryCatalogue);

          await tx.facturationRecurrenteExecution.create({
            data: {
              run_id: runId,
              etablissement_id: tenantId,
              catalogue_frais_id: catalogue.id,
              eleve_id: inscription.eleve_id,
              annee_scolaire_id: annee.id,
              facture_id: invoiceEntry.facture_id,
              created_by_utilisateur_id: senderId,
              periodicite: cycle.periodicite,
              cycle_key: cycle.cycleKey,
              cycle_label: cycle.cycleLabel,
              date_reference: payload.date_reference,
            },
          });
        }
      }

      for (const invoiceEntry of invoiceCache.values()) {
        await ensureFactureEcheances(tx, {
          factureId: invoiceEntry.facture_id,
          lines: [
            {
              ordre: 1,
              date: invoiceEntry.date_echeance,
              montant: invoiceEntry.total_montant,
              statut:
                this.deriveFactureStatus(new Date(invoiceEntry.date_echeance)) === "EN_RETARD"
                  ? "EN_RETARD"
                  : "A_VENIR",
              libelle: `${invoiceEntry.periodicite.toUpperCase()} - ${invoiceEntry.cycle_label}`,
              devise: invoiceEntry.devise,
              note: `Facturation recurrente - ${invoiceEntry.cycle_label}`,
            },
          ],
        });
        await ensurePlanForFacture(tx, {
          factureId: invoiceEntry.facture_id,
          preferredModePaiement: "COMPTANT",
          preferredPaymentDay: new Date(invoiceEntry.date_echeance).getUTCDate(),
        });
        await tryApplyAvailableCreditsToFacture(tx, {
          tenantId,
          factureId: invoiceEntry.facture_id,
          utilisateurId: senderId,
          motif: "Report automatique d'un credit disponible lors de la facturation recurrente.",
        });
        await syncFactureStatusFromEcheances(tx, invoiceEntry.facture_id);
        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            facture_id: invoiceEntry.facture_id,
            cree_par_utilisateur_id: senderId,
            type: "CREATION_FACTURE",
            montant: invoiceEntry.total_montant,
            motif: "Facturation recurrente automatique.",
            details_json: {
              periodicite: invoiceEntry.periodicite,
              cycle_key: invoiceEntry.cycle_key,
              cycle_label: invoiceEntry.cycle_label,
              source: "FACTURATION_RECURRENTE",
            },
          },
        });
        await this.notifyFamilyForGeneratedInvoice(tx as any, {
          tenantId,
          factureId: invoiceEntry.facture_id,
          eleveId: invoiceEntry.eleve_id,
          numeroFacture: invoiceEntry.numero_facture,
          totalMontant: invoiceEntry.total_montant,
          devise: invoiceEntry.devise,
          dueDate: invoiceEntry.date_echeance,
        });

        createdSummaries.set(invoiceEntry.facture_id, {
          facture_id: invoiceEntry.facture_id,
          numero_facture: invoiceEntry.numero_facture,
          eleve_id: invoiceEntry.eleve_id,
          eleve_label: invoiceEntry.eleve_label,
          periodicite: invoiceEntry.periodicite,
          cycle_key: invoiceEntry.cycle_key,
          cycle_label: invoiceEntry.cycle_label,
          date_echeance: invoiceEntry.date_echeance,
          devise: invoiceEntry.devise,
          total_montant: invoiceEntry.total_montant,
          catalogues: [...invoiceEntry.catalogues.values()],
        });
      }
    });

    return {
      run_id: runId,
      annee_scolaire_id: annee.id,
      annee_label: annee.nom,
      created: [...createdSummaries.values()],
      skipped,
    };
  }

  public async getHistory(
    tenantId: string,
    filters: {
      take?: number;
      catalogue_frais_id?: string | null;
      annee_scolaire_id?: string | null;
    } = {},
  ) {
    const safeTake = Math.min(200, Math.max(1, Number(filters.take ?? 50) || 50));

    const executions = await this.prisma.facturationRecurrenteExecution.findMany({
      where: {
        etablissement_id: tenantId,
        ...(filters.catalogue_frais_id ? { catalogue_frais_id: filters.catalogue_frais_id } : {}),
        ...(filters.annee_scolaire_id ? { annee_scolaire_id: filters.annee_scolaire_id } : {}),
      },
      include: {
        catalogueFrais: {
          select: {
            id: true,
            nom: true,
          },
        },
        annee: {
          select: {
            id: true,
            nom: true,
          },
        },
        createur: {
          include: {
            profil: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }],
      take: safeTake,
    });

    const grouped = new Map<string, Record<string, unknown>>();

    for (const execution of executions) {
      const groupKey = `${execution.run_id}::${execution.periodicite}::${execution.cycle_key}`;
      const current = grouped.get(groupKey) ?? {
        run_id: execution.run_id,
        periodicite: execution.periodicite,
        cycle_key: execution.cycle_key,
        cycle_label: execution.cycle_label,
        date_reference: execution.date_reference,
        annee_scolaire_id: execution.annee_scolaire_id,
        annee_label: execution.annee?.nom ?? execution.annee_scolaire_id,
        created_at: execution.created_at,
        created_by:
          execution.createur
            ? [execution.createur.profil?.prenom, execution.createur.profil?.nom]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              execution.createur.email ||
              execution.createur.id
            : null,
        facture_ids: new Set<string>(),
        catalogues: new Map<string, { id: string; nom: string; count: number }>(),
      };

      (current.facture_ids as Set<string>).add(execution.facture_id);
      const catalogues = current.catalogues as Map<string, { id: string; nom: string; count: number }>;
      const existingCatalogue = catalogues.get(execution.catalogue_frais_id) ?? {
        id: execution.catalogue_frais_id,
        nom: execution.catalogueFrais?.nom ?? execution.catalogue_frais_id,
        count: 0,
      };
      existingCatalogue.count += 1;
      catalogues.set(execution.catalogue_frais_id, existingCatalogue);
      grouped.set(groupKey, current);
    }

    return [...grouped.values()].map((item) => ({
      ...item,
      created_count: (item.facture_ids as Set<string>).size,
      facture_ids: undefined,
      catalogues: [...(item.catalogues as Map<string, { id: string; nom: string; count: number }>).values()],
    }));
  }

  public async autoGenerateMonthlyForAllTenants(referenceDate = new Date()) {
    const normalizedReferenceDate = toMonthStart(referenceDate);
    const rows = await this.prisma.catalogueFrais.findMany({
      where: {
        est_recurrent: true,
        periodicite: "monthly",
      },
      select: {
        etablissement_id: true,
      },
      distinct: ["etablissement_id"],
    });

    const results: Array<{
      tenantId: string;
      created_count: number;
      skipped_count: number;
      error?: string;
    }> = [];

    for (const row of rows) {
      try {
        const result = await this.generateForTenant(row.etablissement_id, null, {
          annee_scolaire_id: null,
          catalogue_frais_id: null,
          periodicite: "monthly",
          niveau_scolaire_id: null,
          date_reference: normalizedReferenceDate,
          date_echeance: normalizedReferenceDate,
        });

        results.push({
          tenantId: row.etablissement_id,
          created_count: result.created.length,
          skipped_count: result.skipped.length,
        });
      } catch (error) {
        results.push({
          tenantId: row.etablissement_id,
          created_count: 0,
          skipped_count: 0,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    return {
      periodicite: "monthly",
      reference_date: normalizedReferenceDate,
      results,
    };
  }

  public async autoGenerateRecurringForAllTenants(referenceDate = new Date()) {
    const normalizedReferenceDate = toDateOnly(referenceDate);
    const rows = await this.prisma.catalogueFrais.findMany({
      where: {
        est_recurrent: true,
        periodicite: { in: ["daily", "weekly", "monthly", "term", "semester", "year"] },
      },
      select: {
        etablissement_id: true,
        periodicite: true,
      },
      distinct: ["etablissement_id", "periodicite"],
    });

    const results: Array<{
      tenantId: string;
      periodicite: string;
      created_count: number;
      skipped_count: number;
      error?: string;
    }> = [];

    for (const row of rows) {
      const periodicite = (row.periodicite ?? "").toLowerCase();
      if (!periodicite) continue;

      try {
        const result = await this.generateForTenant(row.etablissement_id, null, {
          annee_scolaire_id: null,
          catalogue_frais_id: null,
          periodicite,
          niveau_scolaire_id: null,
          date_reference: normalizedReferenceDate,
          date_echeance: null,
        });

        results.push({
          tenantId: row.etablissement_id,
          periodicite,
          created_count: result.created.length,
          skipped_count: result.skipped.length,
        });
      } catch (error) {
        results.push({
          tenantId: row.etablissement_id,
          periodicite,
          created_count: 0,
          skipped_count: 0,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    return {
      reference_date: normalizedReferenceDate,
      results,
    };
  }
}

export default FacturationRecurrenteService;
