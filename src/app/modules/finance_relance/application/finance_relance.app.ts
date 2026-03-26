import { randomUUID } from "crypto";
import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";

type FinanceRelancePayload = {
  echeance_ids: string[];
  facture_id: string | null;
  plan_paiement_id: string | null;
  objet_personnalise: string | null;
  message_personnalise: string | null;
};

type ParsedRelanceMeta = {
  batch_id: string;
  facture_id: string | null;
  plan_paiement_id: string | null;
  echeance_ids: string[];
  eleve_id: string | null;
};

type RequestWithAuth = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

const META_PREFIX = "<!--FINANCE_RELANCE_META ";
const META_SUFFIX = "-->";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Date non renseignee";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date non renseignee";
  return parsed.toLocaleDateString("fr-FR");
}

function formatMoney(value: unknown, devise = "MGA") {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} ${devise}`;
}

function getProfilLabel(
  profil?: {
    prenom?: string | null;
    nom?: string | null;
  } | null,
) {
  const fullName = [profil?.prenom?.trim(), profil?.nom?.trim()].filter(Boolean).join(" ").trim();
  return fullName || null;
}

class FinanceRelanceApp {
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
    this.router.post("/", this.send.bind(this));
    this.router.get("/", this.getHistory.bind(this));
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
    const senderId = req.user?.sub?.trim();
    if (!senderId) {
      throw new Error("Aucun utilisateur emetteur n'a ete detecte.");
    }
    return senderId;
  }

  private normalizePayload(raw: Record<string, unknown>): FinanceRelancePayload {
    const echeance_ids = Array.isArray(raw.echeance_ids)
      ? Array.from(
        new Set(
          raw.echeance_ids
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean),
        ),
      )
      : [];

    const facture_id =
      typeof raw.facture_id === "string" && raw.facture_id.trim() ? raw.facture_id.trim() : null;
    const plan_paiement_id =
      typeof raw.plan_paiement_id === "string" && raw.plan_paiement_id.trim()
        ? raw.plan_paiement_id.trim()
        : null;

    if (echeance_ids.length === 0 && !facture_id && !plan_paiement_id) {
      throw new Error("Selectionne au moins une echeance, une facture ou un plan a relancer.");
    }

    return {
      echeance_ids,
      facture_id,
      plan_paiement_id,
      objet_personnalise: normalizeText(raw.objet_personnalise),
      message_personnalise: normalizeText(raw.message_personnalise),
    };
  }

  private async ensureSender(senderId: string, tenantId: string) {
    const sender = await this.prisma.utilisateur.findFirst({
      where: {
        id: senderId,
        etablissement_id: tenantId,
      },
      include: {
        profil: true,
      },
    });

    if (!sender) {
      throw new Error("L'utilisateur emetteur n'appartient pas a cet etablissement.");
    }

    return sender;
  }

  private async getScopedEcheances(payload: FinanceRelancePayload, tenantId: string): Promise<any[]> {
    const where: Record<string, unknown> = {
      eleve: {
        etablissement_id: tenantId,
      },
      montant_restant: {
        gt: 0,
      },
      statut: {
        notIn: ["PAYEE", "ANNULEE"],
      },
    };

    if (payload.echeance_ids.length > 0) {
      where.id = { in: payload.echeance_ids };
    }
    if (payload.facture_id) {
      where.facture_id = payload.facture_id;
    }
    if (payload.plan_paiement_id) {
      where.plan_paiement_id = payload.plan_paiement_id;
    }

    return (await this.prisma.echeancePaiement.findMany({
      where: where as never,
      include: {
        eleve: {
          include: {
            utilisateur: {
              include: {
                profil: true,
              },
            },
            liensParents: {
              include: {
                parent_tuteur: {
                  include: {
                    utilisateur: {
                      include: {
                        profil: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        facture: {
          select: {
            id: true,
            numero_facture: true,
            devise: true,
          },
        },
        planPaiement: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
    })) as any[];
  }

  private buildRelanceMeta(meta: ParsedRelanceMeta) {
    return `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
  }

  private parseRelanceMeta(value?: string | null): ParsedRelanceMeta | null {
    if (!value?.startsWith(META_PREFIX)) return null;
    const endIndex = value.indexOf(META_SUFFIX);
    if (endIndex < 0) return null;
    const rawMeta = value.slice(META_PREFIX.length, endIndex);

    try {
      const parsed = JSON.parse(rawMeta) as ParsedRelanceMeta;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        batch_id: typeof parsed.batch_id === "string" ? parsed.batch_id : "",
        facture_id: typeof parsed.facture_id === "string" ? parsed.facture_id : null,
        plan_paiement_id:
          typeof parsed.plan_paiement_id === "string" ? parsed.plan_paiement_id : null,
        echeance_ids: Array.isArray(parsed.echeance_ids)
          ? parsed.echeance_ids.filter((item): item is string => typeof item === "string")
          : [],
        eleve_id: typeof parsed.eleve_id === "string" ? parsed.eleve_id : null,
      };
    } catch {
      return null;
    }
  }

  private stripRelanceMeta(body?: string | null) {
    if (!body?.startsWith(META_PREFIX)) return body ?? "";
    const endIndex = body.indexOf(META_SUFFIX);
    if (endIndex < 0) return body;
    return body.slice(endIndex + META_SUFFIX.length).trimStart();
  }

  private buildMessageBody(echeances: any[], customMessage: string | null) {
    const first = echeances[0];
    const studentLabel =
      getProfilLabel(first?.eleve?.utilisateur?.profil) ??
      first?.eleve?.code_eleve ??
      "Eleve non renseigne";
    const invoiceNumber = first?.facture?.numero_facture?.trim() ?? "Facture non renseignee";
    const lines = echeances.map((echeance) => {
      const devise = echeance.devise ?? echeance.facture?.devise ?? "MGA";
      return `- ${echeance.libelle?.trim() || `Tranche ${echeance.ordre}`}: ${formatDate(
        echeance.date_echeance,
      )} - reste ${formatMoney(echeance.montant_restant, devise)}`;
    });

    const intro =
      customMessage ??
      "Bonjour, ceci est une relance concernant une ou plusieurs echeances de paiement encore ouvertes.";

    return [
      intro,
      "",
      `Eleve : ${studentLabel}`,
      `Facture : ${invoiceNumber}`,
      "Echeances concernees :",
      ...lines,
      "",
      "Merci de regulariser ou de prendre contact avec l'etablissement.",
    ].join("\n");
  }

  private buildMessageSubject(echeances: any[], customSubject: string | null) {
    if (customSubject) return customSubject;

    const hasOverdue = echeances.some((item) => (item.statut ?? "").toUpperCase() === "EN_RETARD");
    const studentLabel =
      getProfilLabel(echeances[0]?.eleve?.utilisateur?.profil) ??
      echeances[0]?.eleve?.code_eleve ??
      "eleve";

    return hasOverdue
      ? `Relance echeance en retard - ${studentLabel}`
      : `Rappel echeance a venir - ${studentLabel}`;
  }

  private groupEcheances(echeances: any[]) {
    const groups = new Map<string, typeof echeances>();

    for (const echeance of echeances) {
      const key = [
        echeance.eleve_id,
        echeance.facture_id ?? "-",
        echeance.plan_paiement_id ?? "-",
      ].join("::");
      const current = groups.get(key) ?? [];
      current.push(echeance);
      groups.set(key, current);
    }

    return [...groups.values()];
  }

  private getRecipientUsers(echeances: any[]) {
    const recipients = new Map<
      string,
      {
        utilisateur_id: string;
        label: string;
      }
    >();

    for (const echeance of echeances) {
      for (const lien of echeance.eleve?.liensParents ?? []) {
        const utilisateurId = lien.parent_tuteur?.utilisateur_id?.trim();
        if (!utilisateurId) continue;
        const label =
          getProfilLabel(lien.parent_tuteur?.utilisateur?.profil) ??
          lien.parent_tuteur?.nom_complet?.trim() ??
          utilisateurId;
        recipients.set(utilisateurId, {
          utilisateur_id: utilisateurId,
          label,
        });
      }
    }

    if (recipients.size === 0) {
      const eleveUserId = echeances[0]?.eleve?.utilisateur_id?.trim();
      if (eleveUserId) {
        const label =
          getProfilLabel(echeances[0]?.eleve?.utilisateur?.profil) ??
          echeances[0]?.eleve?.code_eleve?.trim() ??
          eleveUserId;
        recipients.set(eleveUserId, {
          utilisateur_id: eleveUserId,
          label,
        });
      }
    }

    return [...recipients.values()];
  }

  private buildHistoryEntry(message: any) {
    const meta = this.parseRelanceMeta(message.corps);
    return {
      id: message.id,
      batch_id: meta?.batch_id ?? message.id,
      objet: message.objet ?? "Relance financiere",
      corps: this.stripRelanceMeta(message.corps),
      envoye_le: message.envoye_le ?? message.created_at,
      facture_id: meta?.facture_id ?? null,
      plan_paiement_id: meta?.plan_paiement_id ?? null,
      echeance_ids: meta?.echeance_ids ?? [],
      eleve_id: meta?.eleve_id ?? null,
      destinataires: (message.destinataires ?? []).map((destinataire: any) => ({
        utilisateur_id: destinataire.utilisateur_id,
        nom:
          getProfilLabel(destinataire.utilisateur?.profil) ??
          destinataire.utilisateur?.email?.trim() ??
          destinataire.utilisateur_id,
        statut: destinataire.statut ?? "sent",
        lu_le: destinataire.lu_le ?? null,
      })),
      expediteur: message.expediteur
        ? {
            id: message.expediteur.id,
            nom:
              getProfilLabel(message.expediteur.profil) ??
              message.expediteur.email?.trim() ??
              message.expediteur.id,
          }
        : null,
    };
  }

  private async send(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const senderId = this.resolveSenderId(request);
      const sender = await this.ensureSender(senderId, tenantId);
      const payload = this.normalizePayload(req.body as Record<string, unknown>);
      const echeances = await this.getScopedEcheances(payload, tenantId);

      if (echeances.length === 0) {
        throw new Error("Aucune echeance ouverte ne correspond a la selection.");
      }

      const grouped = this.groupEcheances(echeances);
      const sent: Array<Record<string, unknown>> = [];
      const skipped: Array<Record<string, unknown>> = [];

      await this.prisma.$transaction(async (tx) => {
        for (const group of grouped) {
          const recipients = this.getRecipientUsers(group);

          if (recipients.length === 0) {
            skipped.push({
              eleve_id: group[0]?.eleve_id ?? null,
              reason: "Aucun destinataire utilisateur n'est relie a ces echeances.",
            });
            continue;
          }

          const batchId = randomUUID();
          const meta: ParsedRelanceMeta = {
            batch_id: batchId,
            facture_id: group[0]?.facture_id ?? null,
            plan_paiement_id: group[0]?.plan_paiement_id ?? null,
            echeance_ids: group.map((item) => item.id),
            eleve_id: group[0]?.eleve_id ?? null,
          };
          const body = `${this.buildRelanceMeta(meta)}\n${this.buildMessageBody(group, payload.message_personnalise)}`;
          const subject = `[FINANCE_RELANCE][${batchId}] ${this.buildMessageSubject(
            group,
            payload.objet_personnalise,
          )}`;

          const message = await tx.message.create({
            data: {
              etablissement_id: tenantId,
              expediteur_utilisateur_id: sender.id,
              objet: subject,
              corps: body,
              envoye_le: new Date(),
              destinataires: {
                create: recipients.map((recipient) => ({
                  utilisateur_id: recipient.utilisateur_id,
                  statut: "sent",
                })),
              },
            },
            include: {
              destinataires: {
                include: {
                  utilisateur: {
                    include: {
                      profil: true,
                    },
                  },
                },
              },
              expediteur: {
                include: {
                  profil: true,
                },
              },
            },
          });

          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              utilisateur_id: recipient.utilisateur_id,
              type: "FINANCE_RELANCE",
              payload_json: {
                batch_id: batchId,
                message_id: message.id,
                facture_id: meta.facture_id,
                plan_paiement_id: meta.plan_paiement_id,
                echeance_ids: meta.echeance_ids,
                eleve_id: meta.eleve_id,
                expediteur_id: sender.id,
              },
            })),
          });

          sent.push(this.buildHistoryEntry(message));
        }
      });

      Response.success(res, "Relance financiere envoyee.", {
        sent,
        skipped,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de l'envoi de la relance financiere", 400, error as Error);
      next(error);
    }
  }

  private async getHistory(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const factureId =
        typeof req.query.facture_id === "string" && req.query.facture_id.trim()
          ? req.query.facture_id.trim()
          : null;
      const planPaiementId =
        typeof req.query.plan_paiement_id === "string" && req.query.plan_paiement_id.trim()
          ? req.query.plan_paiement_id.trim()
          : null;
      const echeanceId =
        typeof req.query.echeance_id === "string" && req.query.echeance_id.trim()
          ? req.query.echeance_id.trim()
          : null;
      const safeTake = Math.min(
        100,
        Math.max(1, Number(typeof req.query.take === "string" ? req.query.take : 20) || 20),
      );

      const messages = await this.prisma.message.findMany({
        where: {
          etablissement_id: tenantId,
          objet: {
            contains: "[FINANCE_RELANCE]",
          },
        },
        include: {
          destinataires: {
            include: {
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            },
          },
          expediteur: {
            include: {
              profil: true,
            },
          },
        },
        orderBy: [{ envoye_le: "desc" }, { created_at: "desc" }],
        take: safeTake,
      });

      const history = messages
        .map((message) => this.buildHistoryEntry(message))
        .filter((item) => {
          if (factureId && item.facture_id !== factureId) return false;
          if (planPaiementId && item.plan_paiement_id !== planPaiementId) return false;
          if (echeanceId && !item.echeance_ids.includes(echeanceId)) return false;
          return true;
        });

      Response.success(res, "Historique des relances financieres.", history);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'historique des relances financieres",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default FinanceRelanceApp;
