import { randomUUID } from "crypto";
import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import {
  ensureFactureEcheances,
  syncFactureStatusFromEcheances,
} from "../../finance_shared/utils/echeance_paiement";

type FacturationRecurrentePayload = {
  annee_scolaire_id: string | null;
  catalogue_frais_id: string | null;
  periodicite: string | null;
  niveau_scolaire_id: string | null;
  date_reference: Date;
  date_echeance: Date | null;
};

type CycleInfo = {
  periodicite: string;
  cycleKey: string;
  cycleLabel: string;
};

type RequestWithAuth = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function toDateOnly(value: Date) {
  return new Date(value.toISOString().slice(0, 10));
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

class FacturationRecurrenteApp {
  public app: Application;
  public router: Router;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/generate", this.generate.bind(this));
    this.router.get("/history", this.getHistory.bind(this));
    return this.router;
  }

  private resolveTenantId(req: RequestWithAuth) {
    const tenantId = req.tenantId?.trim();
    if (!tenantId) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    return tenantId;
  }

  private resolveSenderId(req: RequestWithAuth) {
    return req.user?.sub?.trim() ?? null;
  }

  private parseDate(value: unknown, fallback?: Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (fallback) return fallback;
    throw new Error("La date fournie est invalide.");
  }

  private async buildInvoiceNumber(tx: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], tenantId: string, runningIndex: number) {
    const year = new Date().getFullYear();
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

  private normalizePayload(raw: Record<string, unknown>): FacturationRecurrentePayload {
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
      default:
        throw new Error(`La periodicite ${periodicite} n'est pas prise en charge pour la generation recurrente.`);
    }
  }

  private deriveFactureStatus(dueDate: Date | null): StatutFacture {
    if (dueDate && dueDate < new Date()) return "EN_RETARD";
    return "EMISE";
  }

  private async generate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const senderId = this.resolveSenderId(request);
      const payload = this.normalizePayload(req.body as Record<string, unknown>);
      const annee = await this.resolveAnneeScolaire(tenantId, payload.annee_scolaire_id, payload.date_reference);
      const runId = randomUUID();

      const catalogues = await this.prisma.catalogueFrais.findMany({
        where: {
          etablissement_id: tenantId,
          est_recurrent: true,
          ...(payload.catalogue_frais_id ? { id: payload.catalogue_frais_id } : {}),
          ...(payload.periodicite ? { periodicite: payload.periodicite } : {}),
          ...(payload.niveau_scolaire_id ? { niveau_scolaire_id: payload.niveau_scolaire_id } : {}),
        },
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

      if (inscriptions.length === 0) {
        throw new Error("Aucune inscription active n'a ete trouvee pour l'annee selectionnee.");
      }

      const created: Array<Record<string, unknown>> = [];
      const skipped: Array<Record<string, unknown>> = [];
      let invoiceIndex = 1;

      await this.prisma.$transaction(async (tx) => {
        for (const catalogue of catalogues) {
          const cycle = await this.resolveCycleInfo(
            catalogue.periodicite ?? "",
            annee.id,
            payload.date_reference,
          );

          const eligibleInscriptions = inscriptions.filter(
            (inscription) => inscription.classe?.niveau_scolaire_id === catalogue.niveau_scolaire_id,
          );

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

            const invoiceNumber = await this.buildInvoiceNumber(tx as any, tenantId, invoiceIndex);
            invoiceIndex += 1;
            const dueDate = payload.date_echeance ?? payload.date_reference;
            const label = `${catalogue.nom} - ${cycle.cycleLabel}`;

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
                total_montant: catalogue.montant,
                devise: catalogue.devise ?? "MGA",
                lignes: {
                  create: [
                    {
                      catalogue_frais_id: catalogue.id,
                      libelle: label,
                      quantite: 1,
                      prix_unitaire: catalogue.montant,
                      montant: catalogue.montant,
                    },
                  ],
                },
              },
              include: {
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

            await ensureFactureEcheances(tx, {
              factureId: facture.id,
              lines: [
                {
                  ordre: 1,
                  date: dueDate,
                  montant: Number(catalogue.montant),
                  statut: this.deriveFactureStatus(dueDate) === "EN_RETARD" ? "EN_RETARD" : "A_VENIR",
                  libelle: label,
                  devise: catalogue.devise ?? "MGA",
                  note: `Facturation recurrente - ${cycle.cycleLabel}`,
                },
              ],
            });
            await syncFactureStatusFromEcheances(tx, facture.id);

            await tx.facturationRecurrenteExecution.create({
              data: {
                run_id: runId,
                etablissement_id: tenantId,
                catalogue_frais_id: catalogue.id,
                eleve_id: inscription.eleve_id,
                annee_scolaire_id: annee.id,
                facture_id: facture.id,
                created_by_utilisateur_id: senderId,
                periodicite: cycle.periodicite,
                cycle_key: cycle.cycleKey,
                cycle_label: cycle.cycleLabel,
                date_reference: payload.date_reference,
              },
            });

            created.push({
              facture_id: facture.id,
              numero_facture: facture.numero_facture,
              eleve_id: inscription.eleve_id,
              eleve_label:
                [facture.eleve?.utilisateur?.profil?.prenom, facture.eleve?.utilisateur?.profil?.nom]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                facture.eleve?.code_eleve ||
                inscription.eleve_id,
              catalogue_frais_id: catalogue.id,
              catalogue_label: catalogue.nom,
              periodicite: cycle.periodicite,
              cycle_key: cycle.cycleKey,
              cycle_label: cycle.cycleLabel,
            });
          }
        }
      });

      Response.success(res, "Facturation recurrente generee.", {
        run_id: runId,
        annee_scolaire_id: annee.id,
        annee_label: annee.nom,
        created,
        skipped,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la generation de la facturation recurrente", 400, error as Error);
      next(error);
    }
  }

  private async getHistory(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const safeTake = Math.min(
        200,
        Math.max(1, Number(typeof req.query.take === "string" ? req.query.take : 50) || 50),
      );

      const executions = await this.prisma.facturationRecurrenteExecution.findMany({
        where: {
          etablissement_id: tenantId,
          ...(typeof req.query.catalogue_frais_id === "string" && req.query.catalogue_frais_id.trim()
            ? { catalogue_frais_id: req.query.catalogue_frais_id.trim() }
            : {}),
          ...(typeof req.query.annee_scolaire_id === "string" && req.query.annee_scolaire_id.trim()
            ? { annee_scolaire_id: req.query.annee_scolaire_id.trim() }
            : {}),
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
        const current = grouped.get(execution.run_id) ?? {
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
          created_count: 0,
          catalogues: new Map<string, { id: string; nom: string; count: number }>(),
        };

        current.created_count = Number(current.created_count ?? 0) + 1;
        const catalogues = current.catalogues as Map<string, { id: string; nom: string; count: number }>;
        const existingCatalogue = catalogues.get(execution.catalogue_frais_id) ?? {
          id: execution.catalogue_frais_id,
          nom: execution.catalogueFrais?.nom ?? execution.catalogue_frais_id,
          count: 0,
        };
        existingCatalogue.count += 1;
        catalogues.set(execution.catalogue_frais_id, existingCatalogue);
        grouped.set(execution.run_id, current);
      }

      const history = [...grouped.values()].map((item) => ({
        ...item,
        catalogues: [...(item.catalogues as Map<string, { id: string; nom: string; count: number }>).values()],
      }));

      Response.success(res, "Historique de la facturation recurrente.", history);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'historique de facturation recurrente", 400, error as Error);
      next(error);
    }
  }
}

export default FacturationRecurrenteApp;
