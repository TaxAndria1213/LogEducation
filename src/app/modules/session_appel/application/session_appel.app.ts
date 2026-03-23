import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { SessionAppel, StatutPresence } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import SessionAppelModel from "../models/session_appel.model";

type SessionAppelPayload = {
  emploi_du_temps_id: string;
  classe_id: string;
  date: Date;
  creneau_horaire_id: string;
  pris_par_enseignant_id: string | null;
  pris_le: Date | null;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDayStart(value: Date): Date {
  const date = new Date(value.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateBounds(value: Date) {
  const start = toDayStart(value);
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

class SessionAppelApp {
  public app: Application;
  public router: Router;
  private sessionAppel: SessionAppelModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.sessionAppel = new SessionAppelModel();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.classe === "object" &&
      queryWhere.classe !== null &&
      typeof (queryWhere.classe as { etablissement_id?: unknown }).etablissement_id === "string"
        ? ((queryWhere.classe as { etablissement_id: string }).etablissement_id).trim()
        : typeof queryWhere?.emploi === "object" &&
            queryWhere.emploi !== null &&
            typeof (queryWhere.emploi as { classe?: { etablissement_id?: unknown } }).classe === "object" &&
            (queryWhere.emploi as { classe?: { etablissement_id?: unknown } }).classe !== null &&
            typeof ((queryWhere.emploi as { classe: { etablissement_id?: unknown } }).classe.etablissement_id) === "string"
          ? ((queryWhere.emploi as { classe: { etablissement_id: string } }).classe.etablissement_id).trim()
          : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour la session d'appel.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<SessionAppel>): SessionAppelPayload {
    const emploi_du_temps_id = typeof (raw as Partial<SessionAppel & { emploi_du_temps_id?: string }>).emploi_du_temps_id === "string"
      ? (raw as Partial<SessionAppel & { emploi_du_temps_id?: string }>).emploi_du_temps_id!.trim()
      : "";
    const classe_id = typeof raw.classe_id === "string" ? raw.classe_id.trim() : "";
    const creneau_horaire_id = typeof raw.creneau_horaire_id === "string" ? raw.creneau_horaire_id.trim() : "";
    const date = parseDate(raw.date);
    const prisPar = typeof raw.pris_par_enseignant_id === "string" && raw.pris_par_enseignant_id.trim()
      ? raw.pris_par_enseignant_id.trim()
      : null;
    const prisLe = parseDate(raw.pris_le) ?? null;

    if (!date) throw new Error("La date de la session est invalide.");
    if (!emploi_du_temps_id && (!classe_id || !creneau_horaire_id)) {
      throw new Error("La seance d'emploi du temps est requise pour ouvrir une session d'appel.");
    }

    return {
      emploi_du_temps_id,
      classe_id,
      date: toDayStart(date),
      creneau_horaire_id,
      pris_par_enseignant_id: prisPar,
      pris_le: prisLe,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { classe: { etablissement_id: tenantId } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private getInclude() {
    return {
      classe: {
        include: {
          niveau: true,
          site: true,
          annee: true,
        },
      },
      emploi: {
        include: {
          classe: {
            include: {
              niveau: true,
              site: true,
              annee: true,
            },
          },
          cours: {
            include: {
              matiere: true,
              enseignant: {
                include: {
                  personnel: {
                    include: {
                      utilisateur: { include: { profil: true } },
                    },
                  },
                },
              },
            },
          },
          matiere: true,
          enseignant: {
            include: {
              personnel: {
                include: {
                  utilisateur: { include: { profil: true } },
                },
              },
            },
          },
          salle: true,
          creneau: true,
        },
      },
      creneau: true,
      prisPar: {
        include: {
          personnel: {
            include: {
              utilisateur: { include: { profil: true } },
            },
          },
        },
      },
      presences: {
        include: {
          eleve: {
            include: {
              utilisateur: { include: { profil: true } },
            },
          },
        },
      },
    };
  }

  private async getScopedSession(id: string, tenantId: string) {
    return prisma.sessionAppel.findFirst({
      where: {
        id,
        OR: [
          { classe: { etablissement_id: tenantId } },
          { emploi: { classe: { etablissement_id: tenantId } } },
        ],
      },
      include: this.getInclude(),
    });
  }

  private async resolveEmploiDuTemps(payload: SessionAppelPayload, tenantId: string) {
    const weekday = (() => {
      const day = payload.date.getDay();
      return day === 0 ? 7 : day;
    })();
    const { start, end } = getDateBounds(payload.date);

    const emploi = payload.emploi_du_temps_id
      ? await prisma.emploiDuTemps.findFirst({
          where: {
            id: payload.emploi_du_temps_id,
            classe: { etablissement_id: tenantId },
          },
          include: {
            classe: { include: { annee: true } },
            creneau: true,
          },
        })
      : await prisma.emploiDuTemps.findFirst({
          where: {
            classe_id: payload.classe_id,
            creneau_horaire_id: payload.creneau_horaire_id,
            jour_semaine: weekday,
            classe: { etablissement_id: tenantId },
            effectif_du: { lte: end },
            effectif_au: { gte: start },
          },
          include: {
            classe: { include: { annee: true } },
            creneau: true,
          },
          orderBy: [
            { effectif_du: "desc" },
            { created_at: "asc" },
          ],
        });

    if (!emploi) {
      throw new Error("Aucune seance d'emploi du temps correspondante n'a ete trouvee pour cette date.");
    }

    if (payload.date < emploi.classe.annee.date_debut || payload.date > emploi.classe.annee.date_fin) {
      throw new Error("La date de session doit rester dans l'annee scolaire de la classe.");
    }

    if (emploi.jour_semaine !== weekday) {
      throw new Error("La seance selectionnee ne correspond pas au jour de la session.");
    }

    if (
      (emploi.effectif_du && payload.date < toDayStart(emploi.effectif_du)) ||
      (emploi.effectif_au && payload.date > toDayStart(emploi.effectif_au))
    ) {
      throw new Error("La date de session sort de la fenetre active de la seance.");
    }

    return emploi;
  }

  private async validateReferences(payload: SessionAppelPayload, tenantId: string) {
    const [emploi, enseignant] = await Promise.all([
      this.resolveEmploiDuTemps(payload, tenantId),
      payload.pris_par_enseignant_id
        ? prisma.enseignant.findFirst({
            where: {
              id: payload.pris_par_enseignant_id,
              personnel: { etablissement_id: tenantId },
            },
          })
        : Promise.resolve(null),
    ]);

    if (payload.pris_par_enseignant_id && !enseignant) {
      throw new Error("L'enseignant qui prend l'appel n'appartient pas a l'etablissement actif.");
    }

    return {
      emploi,
      payload: {
        ...payload,
        emploi_du_temps_id: emploi.id,
        classe_id: emploi.classe_id,
        creneau_horaire_id: emploi.creneau_horaire_id ?? emploi.creneau?.id ?? "",
      },
    };
  }

  private async ensureUniqueSession(payload: SessionAppelPayload, excludeId?: string) {
    const existing = await prisma.sessionAppel.findFirst({
      where: {
        emploi_du_temps_id: payload.emploi_du_temps_id,
        date: payload.date,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Une session d'appel existe deja pour cette seance et cette date.");
    }
  }

  private async buildPresenceRows(classe_id: string): Promise<Array<{ eleve_id: string; statut: StatutPresence; minutes_retard: number | null; note: string | null }>> {
    const classe = await prisma.classe.findUnique({
      where: { id: classe_id },
    });

    if (!classe) return [];

    const inscriptions = await prisma.inscription.findMany({
      where: {
        classe_id,
        annee_scolaire_id: classe.annee_scolaire_id,
        statut: "INSCRIT",
      },
      select: { eleve_id: true },
      orderBy: { created_at: "asc" },
    });

    return inscriptions.map((item) => ({
      eleve_id: item.eleve_id,
      statut: "PRESENT",
      minutes_retard: null,
      note: null,
    }));
  }

  private async syncPresences(sessionId: string, classeId: string) {
    const rows = await this.buildPresenceRows(classeId);

    await prisma.$transaction(async (tx) => {
      await tx.presenceEleve.deleteMany({ where: { session_appel_id: sessionId } });
      if (rows.length > 0) {
        await tx.presenceEleve.createMany({
          data: rows.map((row) => ({
            session_appel_id: sessionId,
            eleve_id: row.eleve_id,
            statut: row.statut,
            minutes_retard: row.minutes_retard,
            note: row.note,
          })),
        });
      }
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const normalizedPayload = this.normalizePayload(req.body);
      const { payload } = await this.validateReferences(normalizedPayload, tenantId);
      await this.ensureUniqueSession(payload);

      const result = await prisma.sessionAppel.create({
        data: payload,
      });

      await this.syncPresences(result.id, payload.classe_id);
      const full = await this.getScopedSession(result.id, tenantId);
      Response.success(res, "Session d'appel creee.", full);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la session d'appel", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ date: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.sessionAppel);
      Response.success(res, "Sessions d'appel.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des sessions d'appel", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedSession(req.params.id, tenantId);
      if (!result) throw new Error("Session d'appel introuvable pour cet etablissement.");
      Response.success(res, "Session d'appel detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la session d'appel", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedSession(req.params.id, tenantId);
      if (!existing) throw new Error("Session d'appel introuvable pour cet etablissement.");

      const result = await prisma.$transaction(async (tx) => {
        await tx.presenceEleve.deleteMany({ where: { session_appel_id: req.params.id } });
        return tx.sessionAppel.delete({ where: { id: req.params.id } });
      });
      Response.success(res, "Session d'appel supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la session d'appel", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedSession(req.params.id, tenantId);
      if (!existing) throw new Error("Session d'appel introuvable pour cet etablissement.");

      const normalizedPayload = this.normalizePayload({ ...existing, ...(req.body as Partial<SessionAppel>) });
      const { payload } = await this.validateReferences(normalizedPayload, tenantId);
      await this.ensureUniqueSession(payload, req.params.id);

      await prisma.sessionAppel.update({ where: { id: req.params.id }, data: payload });
      await this.syncPresences(req.params.id, payload.classe_id);
      const result = await this.getScopedSession(req.params.id, tenantId);
      Response.success(res, "Session d'appel mise a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la session d'appel", 400, error as Error);
      next(error);
    }
  }
}

export default SessionAppelApp;
