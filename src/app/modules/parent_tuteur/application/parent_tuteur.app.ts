import { Application, NextFunction, Request, Response as R, Router } from "express";
import { ParentTuteur, Prisma, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { allocatePaiementsToFactureEcheances } from "../../finance_shared/utils/echeance_paiement";
import ParentTuteurModel from "../models/parent_tuteur.model";
import { prisma } from "../../../service/prisma";

type RequestWithAuth = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

type FamilyPaymentPayload = {
  montant_total: number | null;
  methode: string | null;
  reference: string | null;
  paye_le: Date;
  allocations: Array<{
    facture_id: string;
    montant: number;
  }>;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function normalizeMethode(value: unknown) {
  const normalized = normalizeText(value)?.toLowerCase();
  switch (normalized) {
    case "cash":
    case "comptant":
    case "caisse":
      return "cash";
    case "mobile":
    case "mobile money":
    case "mobile_money":
    case "mobile-money":
      return "mobile_money";
    case "virement":
      return "virement";
    case "cheque":
    case "chÃ¨que":
      return "cheque";
    case "bank":
    case "banque":
      return "bank";
    case "famille":
    case "family":
    case "paiement_famille":
    case "family_payment":
      return "famille";
    default:
      return normalized ?? null;
  }
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Date non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non renseignee";
  return date.toLocaleDateString("fr-FR");
}

function formatMoney(value: unknown, devise = "MGA") {
  return `${toMoney(value).toLocaleString("fr-FR")} ${devise}`;
}

function getFullName(
  profil?: {
    prenom?: string | null;
    nom?: string | null;
  } | null,
  fallback?: string | null,
) {
  const fullName = [profil?.prenom?.trim(), profil?.nom?.trim()].filter(Boolean).join(" ").trim();
  return fullName || fallback || "Nom non renseigne";
}

class ParentTuteurApp {
  public app: Application;
  public router: Router;
  private parentTuteur: ParentTuteurModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.parentTuteur = new ParentTuteurModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/family-finance", this.getFamilyFinanceList.bind(this));
    this.router.get("/family-finance/:id", this.getFamilyFinanceOne.bind(this));
    this.router.post("/family-finance/:id/pay", this.createFamilyPayment.bind(this));
    this.router.post("/family-finance/:id/relance", this.sendFamilyRelance.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));

    return this.router;
  }

  private resolveTenantId(req: RequestWithAuth) {
    const requestTenant = req.tenantId?.trim();
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string" ? queryWhere.etablissement_id.trim() : undefined;
    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour les responsables.");
    }
    return tenantCandidates[0];
  }

  private resolveSenderId(req: RequestWithAuth) {
    const senderId = req.user?.sub?.trim();
    if (!senderId) {
      throw new Error("Aucun utilisateur emetteur n'a ete detecte.");
    }
    return senderId;
  }

  private async resolveSchoolYear(tenantId: string, requestedId?: string | null) {
    if (requestedId) {
      const year = await this.prisma.anneeScolaire.findFirst({
        where: {
          id: requestedId,
          etablissement_id: tenantId,
        },
      });
      if (!year) {
        throw new Error("L'annee scolaire demandee n'appartient pas a cet etablissement.");
      }
      return year;
    }

    const activeYear = await this.prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: tenantId,
        est_active: true,
      },
      orderBy: [{ date_debut: "desc" }],
    });

    if (activeYear) return activeYear;

    const latestYear = await this.prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: tenantId,
      },
      orderBy: [{ date_debut: "desc" }],
    });

    if (!latestYear) {
      throw new Error("Aucune annee scolaire n'est configuree pour cet etablissement.");
    }

    return latestYear;
  }

  private normalizeFamilyPaymentPayload(raw: Record<string, unknown>): FamilyPaymentPayload {
    const montantTotal =
      raw.montant_total === undefined || raw.montant_total === null || raw.montant_total === ""
        ? null
        : toMoney(raw.montant_total);
    const allocations = Array.isArray(raw.allocations)
      ? raw.allocations
          .map((item) => {
            const facture_id =
              typeof item === "object" &&
              item !== null &&
              "facture_id" in item &&
              typeof item.facture_id === "string"
                ? item.facture_id.trim()
                : "";
            const montant =
              typeof item === "object" && item !== null && "montant" in item
                ? toMoney(item.montant)
                : 0;
            return { facture_id, montant };
          })
          .filter((item) => item.facture_id && item.montant > 0)
      : [];

    if (montantTotal !== null && montantTotal <= 0) {
      throw new Error("Le montant total du paiement famille doit etre positif.");
    }

    return {
      montant_total: montantTotal,
      allocations,
      methode: normalizeMethode(raw.methode),
      reference: normalizeText(raw.reference),
      paye_le:
        raw.paye_le instanceof Date
          ? raw.paye_le
          : typeof raw.paye_le === "string" || typeof raw.paye_le === "number"
            ? new Date(raw.paye_le)
            : new Date(),
    };
  }

  private requiresExternalReference(methode: string | null) {
    return ["mobile_money", "virement", "cheque", "bank"].includes(
      (methode ?? "").toLowerCase(),
    );
  }

  private canAutoGenerateReference(methode: string | null) {
    return ["cash", "famille"].includes((methode ?? "").toLowerCase());
  }

  private getReferencePrefix(methode: string | null) {
    switch ((methode ?? "").toLowerCase()) {
      case "cash":
        return "CAISSE";
      case "famille":
        return "FAM";
      default:
        return "PAIEMENT";
    }
  }

  private async buildAutomaticReference(tenantId: string, methode: string | null, payeLe: Date) {
    const prefix = this.getReferencePrefix(methode);
    const dateKey = payeLe.toISOString().slice(0, 10).replace(/-/g, "");
    const start = new Date(payeLe);
    start.setHours(0, 0, 0, 0);
    const end = new Date(payeLe);
    end.setHours(23, 59, 59, 999);

    const count = await this.prisma.paiement.count({
      where: {
        facture: {
          is: {
            etablissement_id: tenantId,
          },
        },
        methode: methode ?? undefined,
        paye_le: {
          gte: start,
          lte: end,
        },
      },
    });

    return `${prefix}-${dateKey}-${String(count + 1).padStart(4, "0")}`;
  }

  private async getParentScoped(parentId: string, tenantId: string) {
    const parent = await this.prisma.parentTuteur.findFirst({
      where: {
        id: parentId,
        etablissement_id: tenantId,
      },
      include: {
        utilisateur: {
          include: {
            profil: true,
          },
        },
        eleves: {
          include: {
            eleve: {
              include: {
                utilisateur: {
                  include: {
                    profil: true,
                  },
                },
                inscriptions: {
                  include: {
                    classe: {
                      include: {
                        niveau: true,
                      },
                    },
                    annee: true,
                  },
                  orderBy: [{ date_inscription: "asc" }],
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new Error("Le parent/tuteur selectionne n'appartient pas a cet etablissement.");
    }

    return parent;
  }

  private async getOpenFamilyEcheances(tenantId: string, parentId: string, anneeScolaireId: string) {
    return this.prisma.echeancePaiement.findMany({
      where: {
        annee_scolaire_id: anneeScolaireId,
        montant_restant: { gt: 0 },
        statut: { notIn: ["PAYEE", "ANNULEE"] },
        eleve: {
          etablissement_id: tenantId,
          liensParents: {
            some: {
              parent_tuteur_id: parentId,
            },
          },
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
            inscriptions: {
              where: {
                annee_scolaire_id: anneeScolaireId,
              },
              include: {
                classe: {
                  include: {
                    niveau: true,
                  },
                },
              },
              orderBy: [{ date_inscription: "asc" }],
            },
          },
        },
        facture: {
          include: {
            paiements: true,
          },
        },
        planPaiement: true,
      },
      orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
    });
  }

  private buildFamilySummary(parent: any, annee: { id: string; nom: string }, echeances: any[]) {
    const currentChildren = (parent.eleves ?? [])
      .map((link: any) => {
        const inscription =
          link.eleve?.inscriptions?.find((item: any) => item.annee_scolaire_id === annee.id) ?? null;
        return {
          parent_link: link,
          eleve: link.eleve,
          inscription,
        };
      })
      .filter((item: any) => Boolean(item.eleve));

    const rankedChildren = [...currentChildren]
      .filter((item: any) => item.inscription?.statut === "INSCRIT")
      .sort((left: any, right: any) => {
        const leftDate = new Date(left.inscription?.date_inscription ?? 0).getTime();
        const rightDate = new Date(right.inscription?.date_inscription ?? 0).getTime();
        return leftDate - rightDate;
      });

    const rankByEleveId = new Map<string, number>();
    rankedChildren.forEach((item: any, index: number) => {
      rankByEleveId.set(item.eleve.id, index + 1);
    });

    const childCards = currentChildren.map((item: any) => {
      const eleveEcheances = echeances.filter((echeance) => echeance.eleve_id === item.eleve.id);
      const totalDue = eleveEcheances.reduce(
        (sum, echeance) => sum + toMoney(echeance.montant_restant),
        0,
      );
      const totalOverdue = eleveEcheances
        .filter((echeance) => (echeance.statut ?? "").toUpperCase() === "EN_RETARD")
        .reduce((sum, echeance) => sum + toMoney(echeance.montant_restant), 0);

      return {
        eleve_id: item.eleve.id,
        code_eleve: item.eleve.code_eleve ?? null,
        nom_complet: getFullName(item.eleve.utilisateur?.profil, item.eleve.code_eleve),
        relation: item.parent_link?.relation ?? null,
        classe: item.inscription?.classe?.nom ?? null,
        niveau: item.inscription?.classe?.niveau?.nom ?? null,
        statut_inscription: item.inscription?.statut ?? null,
        sibling_rank: rankByEleveId.get(item.eleve.id) ?? null,
        total_du: toMoney(totalDue),
        total_en_retard: toMoney(totalOverdue),
        nombre_echeances_ouvertes: eleveEcheances.length,
        echeances: eleveEcheances.map((echeance) => ({
          id: echeance.id,
          ordre: echeance.ordre,
          libelle: echeance.libelle,
          statut: echeance.statut,
          date_echeance: echeance.date_echeance,
          montant_prevu: toMoney(echeance.montant_prevu),
          montant_restant: toMoney(echeance.montant_restant),
          devise: echeance.devise ?? "MGA",
          facture_id: echeance.facture_id ?? null,
          numero_facture: echeance.facture?.numero_facture ?? null,
          plan_paiement_id: echeance.plan_paiement_id ?? null,
        })),
      };
    });

    const totalDue = childCards.reduce((sum: number, child: any) => sum + child.total_du, 0);
    const totalOverdue = childCards.reduce(
      (sum: number, child: any) => sum + child.total_en_retard,
      0,
    );

    return {
      id: parent.id,
      nom_complet: parent.nom_complet,
      telephone: parent.telephone ?? null,
      email: parent.email ?? null,
      utilisateur_id: parent.utilisateur_id ?? null,
      annee_scolaire_id: annee.id,
      annee_scolaire_nom: annee.nom,
      fratrie_detectee: childCards.filter((child: any) => child.sibling_rank !== null).length > 1,
      nombre_enfants: childCards.length,
      total_du: toMoney(totalDue),
      total_en_retard: toMoney(totalOverdue),
      nombre_echeances_ouvertes: echeances.length,
      enfants: childCards,
    };
  }

  private async ensureParentUser(parent: any) {
    if (!parent.utilisateur_id) {
      throw new Error("Ce parent/tuteur n'est rattache a aucun compte utilisateur.");
    }
    return parent.utilisateur_id;
  }

  private buildFamilyRelanceBody(summary: any, customMessage?: string | null) {
    const intro =
      customMessage ??
      "Bonjour, voici une relance regroupee concernant les echeances encore ouvertes pour votre famille.";

    const childSections = summary.enfants
      .filter((child: any) => child.echeances.length > 0)
      .map((child: any) => {
        const lines = child.echeances.map((echeance: any) => {
          return `- ${child.nom_complet} | ${echeance.libelle ?? `Tranche ${echeance.ordre}`}: ${formatDate(
            echeance.date_echeance,
          )} - reste ${formatMoney(echeance.montant_restant, echeance.devise)}`;
        });
        return lines.join("\n");
      })
      .filter(Boolean)
      .join("\n");

    return `${intro}\n\n${childSections}\n\nTotal restant famille: ${formatMoney(summary.total_du)}`;
  }

  private async sendFamilyRelanceRecord(
    tenantId: string,
    senderId: string,
    parent: any,
    summary: any,
    customObject?: string | null,
    customMessage?: string | null,
  ) {
    const parentUserId = await this.ensureParentUser(parent);
    const objet = customObject ?? `Relance famille - ${parent.nom_complet}`;
    const corps = this.buildFamilyRelanceBody(summary, customMessage);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          etablissement_id: tenantId,
          expediteur_utilisateur_id: senderId,
          objet,
          corps,
          envoye_le: new Date(),
        },
      });

      await tx.messageDestinataire.create({
        data: {
          message_id: message.id,
          utilisateur_id: parentUserId,
          statut: "ENVOYE",
        },
      });

      await tx.notification.create({
        data: {
          utilisateur_id: parentUserId,
          type: "FINANCE_RELANCE_FAMILLE",
          payload_json: {
            parent_tuteur_id: parent.id,
            annee_scolaire_id: summary.annee_scolaire_id,
            total_du: summary.total_du,
            nombre_enfants: summary.nombre_enfants,
            nombre_echeances_ouvertes: summary.nombre_echeances_ouvertes,
            children: summary.enfants.map((child: any) => ({
              eleve_id: child.eleve_id,
              nom_complet: child.nom_complet,
              total_du: child.total_du,
              total_en_retard: child.total_en_retard,
            })),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        message_id: message.id,
        utilisateur_id: parentUserId,
      };
    });
  }

  private buildAutomaticAllocations(summary: any, montantTotal: number) {
    let remaining = toMoney(montantTotal);
    const byFacture = new Map<string, number>();

    for (const child of summary.enfants) {
      for (const echeance of child.echeances) {
        if (remaining <= 0) break;
        if (!echeance.facture_id) continue;

        const amount = Math.min(remaining, toMoney(echeance.montant_restant));
        if (amount <= 0) continue;

        byFacture.set(echeance.facture_id, toMoney((byFacture.get(echeance.facture_id) ?? 0) + amount));
        remaining = toMoney(remaining - amount);
      }
      if (remaining <= 0) break;
    }

    return [...byFacture.entries()].map(([facture_id, montant]) => ({
      facture_id,
      montant,
    }));
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const data: ParentTuteur = req.body;
      const result = await this.parentTuteur.create(data);
      Response.success(res, "Stablisment creation success.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'etablissement", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.parentTuteur);
      Response.success(res, "Stablisment list.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des etablissements", 400, error as Error);
      next(error);
    }
  }

  private async getFamilyFinanceList(req: RequestWithAuth, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const requestedYearId =
        typeof req.query.annee_scolaire_id === "string" ? req.query.annee_scolaire_id.trim() : null;
      const annee = await this.resolveSchoolYear(tenantId, requestedYearId);

      const parents = await this.prisma.parentTuteur.findMany({
        where: {
          etablissement_id: tenantId,
        },
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
          eleves: {
            include: {
              eleve: {
                include: {
                  utilisateur: {
                    include: {
                      profil: true,
                    },
                  },
                  inscriptions: {
                    where: {
                      annee_scolaire_id: annee.id,
                    },
                    include: {
                      classe: {
                        include: {
                          niveau: true,
                        },
                      },
                    },
                    orderBy: [{ date_inscription: "asc" }],
                  },
                },
              },
            },
          },
        },
        orderBy: [{ nom_complet: "asc" }],
      });

      const summaries = await Promise.all(
        parents.map(async (parent) => {
          const echeances = await this.getOpenFamilyEcheances(tenantId, parent.id, annee.id);
          return this.buildFamilySummary(parent, annee, echeances);
        }),
      );

      Response.success(res, "Synthese famille finance.", summaries);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des syntheses famille.", 400, error as Error);
      next(error);
    }
  }

  private async getFamilyFinanceOne(req: RequestWithAuth, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const requestedYearId =
        typeof req.query.annee_scolaire_id === "string" ? req.query.annee_scolaire_id.trim() : null;
      const annee = await this.resolveSchoolYear(tenantId, requestedYearId);
      const parent = await this.getParentScoped(req.params.id, tenantId);
      const echeances = await this.getOpenFamilyEcheances(tenantId, parent.id, annee.id);

      Response.success(res, "Synthese finance parent.", this.buildFamilySummary(parent, annee, echeances));
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la synthese finance parent.", 400, error as Error);
      next(error);
    }
  }

  private async createFamilyPayment(req: RequestWithAuth, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const senderId = this.resolveSenderId(req);
      const requestedYearId =
        typeof req.body?.annee_scolaire_id === "string" ? req.body.annee_scolaire_id.trim() : null;
      const annee = await this.resolveSchoolYear(tenantId, requestedYearId);
      const parent = await this.getParentScoped(req.params.id, tenantId);
      const summary = this.buildFamilySummary(
        parent,
        annee,
        await this.getOpenFamilyEcheances(tenantId, parent.id, annee.id),
      );
      const payload = this.normalizeFamilyPaymentPayload(req.body as Record<string, unknown>);
      if (this.requiresExternalReference(payload.methode) && !payload.reference) {
        throw new Error(
          "Une reference est obligatoire pour les paiements famille en Mobile Money, virement, cheque ou banque.",
        );
      }
      const baseReference =
        payload.reference ??
        (this.canAutoGenerateReference(payload.methode)
          ? await this.buildAutomaticReference(tenantId, payload.methode, payload.paye_le)
          : null);
      const allocations =
        payload.allocations.length > 0
          ? payload.allocations
          : payload.montant_total !== null
            ? this.buildAutomaticAllocations(summary, payload.montant_total)
            : [];

      if (allocations.length === 0) {
        throw new Error("Aucune repartition de paiement famille n'a ete fournie.");
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const payments: Array<Record<string, unknown>> = [];

        for (const allocation of allocations) {
          const facture = await tx.facture.findFirst({
            where: {
              id: allocation.facture_id,
              etablissement_id: tenantId,
              eleve: {
                liensParents: {
                  some: {
                    parent_tuteur_id: parent.id,
                  },
                },
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
              paiements: true,
              echeances: {
                where: {
                  montant_restant: { gt: 0 },
                  statut: { notIn: ["PAYEE", "ANNULEE"] },
                },
              },
            },
          });

          if (!facture) {
            throw new Error("Une facture de la repartition famille n'est pas accessible pour ce parent.");
          }

          const remaining = facture.echeances.reduce(
            (sum, echeance) => sum + toMoney(echeance.montant_restant),
            0,
          );

          if (allocation.montant > remaining + 0.009) {
            throw new Error(`Le montant affecte depasse le restant de la facture ${facture.numero_facture}.`);
          }

          const reference =
            allocations.length > 1 && baseReference
              ? `${baseReference}-${payments.length + 1}`
              : baseReference;

          const paiement = await tx.paiement.create({
            data: {
              facture_id: facture.id,
              montant: allocation.montant,
              paye_le: payload.paye_le,
              methode: payload.methode,
              reference,
              recu_par: senderId,
              statut: "ENREGISTRE",
            },
          });

          await allocatePaiementsToFactureEcheances(tx, facture.id);

          payments.push({
            paiement_id: paiement.id,
            facture_id: facture.id,
            numero_facture: facture.numero_facture,
            montant: allocation.montant,
            eleve_id: facture.eleve_id,
            eleve_nom_complet: getFullName(facture.eleve.utilisateur?.profil, facture.eleve.code_eleve),
          });
        }

        return payments;
      });

      Response.success(res, "Paiement famille enregistre.", {
        parent_tuteur_id: parent.id,
        annee_scolaire_id: annee.id,
        paiements: created,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement du paiement famille.", 400, error as Error);
      next(error);
    }
  }

  private async sendFamilyRelance(req: RequestWithAuth, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const senderId = this.resolveSenderId(req);
      const requestedYearId =
        typeof req.body?.annee_scolaire_id === "string" ? req.body.annee_scolaire_id.trim() : null;
      const annee = await this.resolveSchoolYear(tenantId, requestedYearId);
      const parent = await this.getParentScoped(req.params.id, tenantId);
      const summary = this.buildFamilySummary(
        parent,
        annee,
        await this.getOpenFamilyEcheances(tenantId, parent.id, annee.id),
      );

      if (summary.total_du <= 0) {
        throw new Error("Aucune dette ouverte n'a ete trouvee pour cette famille.");
      }

      const result = await this.sendFamilyRelanceRecord(
        tenantId,
        senderId,
        parent,
        summary,
        normalizeText(req.body?.objet_personnalise),
        normalizeText(req.body?.message_personnalise),
      );

      Response.success(res, "Relance famille envoyee.", {
        ...result,
        parent_tuteur_id: parent.id,
        total_du: summary.total_du,
        nombre_enfants: summary.nombre_enfants,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de l'envoi de la relance famille.", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.parentTuteur.findUnique(id);
      Response.success(res, "Stablisment result.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.parentTuteur.delete(id);
      Response.success(res, "Stablisment deleted.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: ParentTuteur = req.body;
      const result = await this.parentTuteur.update(id, data);
      Response.success(res, "Stablisment updated.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default ParentTuteurApp;

