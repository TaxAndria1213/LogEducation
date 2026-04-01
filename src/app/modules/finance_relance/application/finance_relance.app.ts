import { randomUUID } from "crypto";
import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Prisma } from "@prisma/client";
import Response from "../../../common/app/response";
import { ensureFactureEcheances } from "../../finance_shared/utils/echeance_paiement";
import {
  calculateRecoveryPenalty,
  getApprovedRecoveryPolicy,
  normalizeRelanceDays,
} from "../../finance_shared/utils/recovery_policy";

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
  stage_days?: number | null;
  suggested_penalty?: number | null;
  penalty_facture_id?: string | null;
  penalty_facture_number?: string | null;
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
    this.router.post("/run-calendar", this.runCalendar.bind(this));
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

  private async buildInvoiceNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: {
        etablissement_id: tenantId,
        numero_facture: {
          startsWith: `FAC-${year}-`,
        },
      },
    });
    return `FAC-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  private async materializePenaltyForRelance(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      senderId: string;
      batchId: string;
      group: any[];
      stageDays: number;
      penaltyAmount: number;
      referenceDate: Date;
    },
  ) {
    const penaltyAmount = Number(args.penaltyAmount ?? 0);
    if (!Number.isFinite(penaltyAmount) || penaltyAmount <= 0) return null;

    const originFactureId = args.group[0]?.facture_id ?? null;
    const originFactureNumber = args.group[0]?.facture?.numero_facture?.trim() ?? null;
    if (!originFactureId) return null;

    const motif = `Penalite de retard J+${args.stageDays} - ${originFactureNumber ?? originFactureId}`;
    const existing = await tx.operationFinanciere.findFirst({
      where: {
        etablissement_id: args.tenantId,
        facture_id: originFactureId,
        type: "PENALITE_RELANCE",
        motif,
      },
      select: {
        details_json: true,
      },
    });

    if (existing?.details_json && typeof existing.details_json === "object" && !Array.isArray(existing.details_json)) {
      const details = existing.details_json as Record<string, unknown>;
      if (typeof details.facture_penalite_id === "string" || typeof details.facture_penalite_number === "string") {
        return {
          id: typeof details.facture_penalite_id === "string" ? details.facture_penalite_id : null,
          numero_facture: typeof details.facture_penalite_number === "string" ? details.facture_penalite_number : null,
          montant: penaltyAmount,
        };
      }
    }

    const numeroFacture = await this.buildInvoiceNumber(args.tenantId);
    const eleveId = args.group[0]?.eleve_id;
    const anneeScolaireId = args.group[0]?.annee_scolaire_id;
    const devise = args.group[0]?.facture?.devise ?? args.group[0]?.devise ?? "MGA";
    if (!eleveId || !anneeScolaireId) return null;

    const penaltyFacture = await tx.facture.create({
      data: {
        etablissement_id: args.tenantId,
        eleve_id: eleveId,
        annee_scolaire_id: anneeScolaireId,
        remise_id: null,
        facture_origine_id: null,
        nature: "COMPLEMENTAIRE",
        numero_facture: numeroFacture,
        date_emission: args.referenceDate,
        date_echeance: args.referenceDate,
        statut: "EMISE",
        total_montant: penaltyAmount,
        devise,
      } as never,
    });

    await tx.factureLigne.create({
      data: {
        facture_id: penaltyFacture.id,
        catalogue_frais_id: null,
        libelle: motif,
        quantite: 1,
        prix_unitaire: penaltyAmount,
        montant: penaltyAmount,
      } as never,
    });

    await ensureFactureEcheances(tx, { factureId: penaltyFacture.id });

    await tx.operationFinanciere.create({
      data: {
        etablissement_id: args.tenantId,
        facture_id: originFactureId,
        cree_par_utilisateur_id: args.senderId,
        type: "PENALITE_RELANCE",
        montant: penaltyAmount,
        motif,
        details_json: {
          batch_id: args.batchId,
          stage_days: args.stageDays,
          facture_penalite_id: penaltyFacture.id,
          facture_penalite_number: penaltyFacture.numero_facture,
        },
      } as never,
    });

    return {
      id: penaltyFacture.id,
      numero_facture: penaltyFacture.numero_facture,
      montant: penaltyAmount,
    };
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
        stage_days: typeof parsed.stage_days === "number" ? parsed.stage_days : null,
        suggested_penalty:
          typeof parsed.suggested_penalty === "number" ? parsed.suggested_penalty : null,
        penalty_facture_id:
          typeof parsed.penalty_facture_id === "string" ? parsed.penalty_facture_id : null,
        penalty_facture_number:
          typeof parsed.penalty_facture_number === "string" ? parsed.penalty_facture_number : null,
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

  private buildMessageBody(
    echeances: any[],
    customMessage: string | null,
    options?: {
      stageDays?: number | null;
      suggestedPenalty?: number | null;
      penaltyFactureNumber?: string | null;
    },
  ) {
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
      options?.stageDays != null ? `Palier de relance : J+${options.stageDays}` : null,
      options?.suggestedPenalty && options.suggestedPenalty > 0
        ? options?.penaltyFactureNumber
          ? `Penalite appliquee selon la regle approuvee : ${formatMoney(options.suggestedPenalty, first?.facture?.devise ?? "MGA")} (facture ${options.penaltyFactureNumber})`
          : `Penalite suggeree selon la regle approuvee : ${formatMoney(options.suggestedPenalty, first?.facture?.devise ?? "MGA")}`
        : null,
      "Echeances concernees :",
      ...lines,
      "",
      "Merci de regulariser ou de prendre contact avec l'etablissement.",
    ]
      .filter(Boolean)
      .join("\n");
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
      stage_days: meta?.stage_days ?? null,
      suggested_penalty: meta?.suggested_penalty ?? null,
      penalty_facture_id: meta?.penalty_facture_id ?? null,
      penalty_facture_number: meta?.penalty_facture_number ?? null,
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

  private computeOverdueDays(referenceDate: Date, dueDate: Date | string | null | undefined) {
    if (!dueDate) return 0;
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);
    const due = dueDate instanceof Date ? new Date(dueDate) : new Date(dueDate);
    if (Number.isNaN(due.getTime())) return 0;
    due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((ref.getTime() - due.getTime()) / 86400000));
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

  public async runCalendarForTenant(tenantId: string, senderId: string, referenceDate = new Date()) {
    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error("La date de reference de relance est invalide.");
    }

    const sender = await this.ensureSender(senderId, tenantId);
    const policy = await getApprovedRecoveryPolicy(this.prisma, tenantId);
    if (!policy) {
      throw new Error("Aucune regle de recouvrement approuvee n'est disponible pour le calendrier de relance.");
    }

    const stages = normalizeRelanceDays(policy.relance_jours_json as any);
    if (stages.length === 0) {
      throw new Error("Aucun palier de relance n'est defini dans la regle approuvee.");
    }

    const overdueEcheances = await this.prisma.echeancePaiement.findMany({
      where: {
        eleve: { etablissement_id: tenantId },
        montant_restant: { gt: 0 },
        statut: { notIn: ["PAYEE", "ANNULEE"] },
      } as never,
      include: {
        eleve: {
          include: {
            utilisateur: { include: { profil: true } },
            liensParents: {
              include: {
                parent_tuteur: {
                  include: {
                    utilisateur: { include: { profil: true } },
                  },
                },
              },
            },
          },
        },
        facture: {
          select: { id: true, numero_facture: true, devise: true },
        },
        planPaiement: {
          select: { id: true },
        },
      },
      orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
    });

    const overdueGroups = this.groupEcheances(
      overdueEcheances.filter((item) => this.computeOverdueDays(referenceDate, item.date_echeance) > 0),
    );

    const messages = await this.prisma.message.findMany({
      where: {
        etablissement_id: tenantId,
        objet: { contains: "[FINANCE_RELANCE]" },
      },
      select: {
        id: true,
        objet: true,
        corps: true,
      },
    });

    const existingStages = new Map<string, Set<number>>();
    for (const message of messages) {
      const meta = this.parseRelanceMeta(message.corps);
      if (!meta || typeof meta.stage_days !== "number") continue;
      const key = [meta.eleve_id ?? "-", meta.facture_id ?? "-", meta.plan_paiement_id ?? "-"].join("::");
      const current = existingStages.get(key) ?? new Set<number>();
      current.add(meta.stage_days);
      existingStages.set(key, current);
    }

    const sent: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const group of overdueGroups) {
        const recipients = this.getRecipientUsers(group);
        if (recipients.length === 0) {
          skipped.push({
            eleve_id: group[0]?.eleve_id ?? null,
            reason: "Aucun destinataire utilisateur n'est relie a ces echeances.",
          });
          continue;
        }

        const oldestDueDate = group.reduce<Date | null>((min, item) => {
          const date = item.date_echeance instanceof Date ? item.date_echeance : new Date(item.date_echeance);
          if (Number.isNaN(date.getTime())) return min;
          if (!min || date < min) return date;
          return min;
        }, null);
        if (!oldestDueDate) continue;

        const overdueDays = this.computeOverdueDays(referenceDate, oldestDueDate);
        const key = [group[0]?.eleve_id ?? "-", group[0]?.facture_id ?? "-", group[0]?.plan_paiement_id ?? "-"].join("::");
        const alreadySentStages = existingStages.get(key) ?? new Set<number>();
        const stageDays = [...stages].reverse().find((value) => overdueDays >= value && !alreadySentStages.has(value));

        if (stageDays == null) {
          skipped.push({
            eleve_id: group[0]?.eleve_id ?? null,
            facture_id: group[0]?.facture_id ?? null,
            reason: "Aucun nouveau palier de relance a envoyer pour ce dossier.",
          });
          continue;
        }

        const overdueAmount = group.reduce((sum, item) => sum + Number(item.montant_restant ?? 0), 0);
        const suggestedPenalty = calculateRecoveryPenalty({
          policy,
          overdueAmount,
          dueDate: oldestDueDate,
          paymentDate: referenceDate,
        });

        const batchId = randomUUID();
        const penaltyFacture =
          suggestedPenalty > 0
            ? await this.materializePenaltyForRelance(tx, {
                tenantId,
                senderId: sender.id,
                batchId,
                group,
                stageDays,
                penaltyAmount: suggestedPenalty,
                referenceDate,
              })
            : null;
        const meta: ParsedRelanceMeta = {
          batch_id: batchId,
          facture_id: group[0]?.facture_id ?? null,
          plan_paiement_id: group[0]?.plan_paiement_id ?? null,
          echeance_ids: group.map((item) => item.id),
          eleve_id: group[0]?.eleve_id ?? null,
          stage_days: stageDays,
          suggested_penalty: suggestedPenalty > 0 ? suggestedPenalty : null,
          penalty_facture_id: penaltyFacture?.id ?? null,
          penalty_facture_number: penaltyFacture?.numero_facture ?? null,
        };
        const body = `${this.buildRelanceMeta(meta)}\n${this.buildMessageBody(group, null, {
          stageDays,
          suggestedPenalty,
          penaltyFactureNumber: penaltyFacture?.numero_facture ?? null,
        })}`;
        const subject = `[FINANCE_RELANCE][${batchId}] Relance calendrier J+${stageDays}`;

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
                utilisateur: { include: { profil: true } },
              },
            },
            expediteur: {
              include: { profil: true },
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
              stage_days: stageDays,
              suggested_penalty: suggestedPenalty > 0 ? suggestedPenalty : null,
              penalty_facture_id: penaltyFacture?.id ?? null,
              penalty_facture_number: penaltyFacture?.numero_facture ?? null,
            },
          })),
        });

        alreadySentStages.add(stageDays);
        existingStages.set(key, alreadySentStages);
        sent.push(this.buildHistoryEntry(message));
      }
    });

    return { sent, skipped, stages };
  }

  private async runCalendar(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const senderId = this.resolveSenderId(request);
      const referenceDate = req.body?.date_reference ? new Date(req.body.date_reference) : new Date();
      const result = await this.runCalendarForTenant(tenantId, senderId, referenceDate);
      Response.success(res, "Calendrier de relance execute.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'execution du calendrier de relance", 400, error as Error);
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
      });

      const history = messages
        .map((message) => this.buildHistoryEntry(message))
        .filter((item) => {
          if (factureId && item.facture_id !== factureId) return false;
          if (planPaiementId && item.plan_paiement_id !== planPaiementId) return false;
          if (echeanceId && !item.echeance_ids.includes(echeanceId)) return false;
          return true;
        })
        .slice(0, safeTake);

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







