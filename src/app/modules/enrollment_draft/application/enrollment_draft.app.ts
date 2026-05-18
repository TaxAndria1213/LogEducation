/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import InscriptionApp from "../../inscription/application/inscription.app";
import EnrollmentDraftModel from "../models/enrollment_draft.model";

type DraftType = "NEW_ENROLLMENT" | "RE_ENROLLMENT" | "TRANSFER" | "PRE_ENROLLMENT";
type DraftStatus = "DRAFT" | "IN_PROGRESS" | "READY_TO_SUBMIT" | "SUBMITTED" | "EXPIRED" | "DELETED";

const DRAFT_TYPES: DraftType[] = ["NEW_ENROLLMENT", "RE_ENROLLMENT", "TRANSFER", "PRE_ENROLLMENT"];
const ACTIVE_STATUSES: DraftStatus[] = ["DRAFT", "IN_PROGRESS", "READY_TO_SUBMIT"];

class EnrollmentDraftApp {
  public app: Application;
  public router: Router;
  private draft: EnrollmentDraftModel;
  private prisma: PrismaClient;
  private inscriptionApp: InscriptionApp;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.draft = new EnrollmentDraftModel();
    this.prisma = prisma;
    this.inscriptionApp = new InscriptionApp(app);
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.post("/from-student/:studentId", this.createFromStudent.bind(this));
    this.router.get("/:id/summary", this.getSummary.bind(this));
    this.router.patch("/:id/autosave", this.autosave.bind(this));
    this.router.post("/:id/restore", this.restore.bind(this));
    this.router.post("/:id/submit", this.prepareSubmit.bind(this));
    this.router.post("/:id/mark-submitted", this.markSubmitted.bind(this));
    this.router.post("/:id/files", this.createFile.bind(this));
    this.router.get("/:id/files", this.getFiles.bind(this));
    this.router.delete("/:id/files/:fileId", this.deleteFile.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.put("/:id", this.update.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant = typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const where = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant = typeof where?.etablissement_id === "string" ? where.etablissement_id.trim() : undefined;
    const candidates = [requestTenant, bodyTenant, queryTenant].filter((value): value is string => Boolean(value));

    if (candidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(candidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le brouillon d'inscription.");
    }

    return candidates[0];
  }

  private getActorId(req: Request): string | null {
    const user = (req as Request & { user?: { sub?: string; id?: string } }).user;
    return user?.sub ?? user?.id ?? null;
  }

  private normalizeDraftType(value: unknown): DraftType {
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : "NEW_ENROLLMENT";
    if (!DRAFT_TYPES.includes(normalized as DraftType)) {
      throw new Error("Le type de brouillon est invalide.");
    }
    return normalized as DraftType;
  }

  private normalizeCurrentStep(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }

  private asJsonObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private async resolveActiveYear(etablissementId: string, requestedYearId?: unknown) {
    const explicitYearId = typeof requestedYearId === "string" && requestedYearId.trim() ? requestedYearId.trim() : null;
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: etablissementId,
        ...(explicitYearId ? { id: explicitYearId } : { est_active: true }),
      },
      select: { id: true, nom: true, date_debut: true, date_fin: true },
    });

    if (!annee) {
      throw new Error(explicitYearId ? "L'annee scolaire selectionnee n'appartient pas a cet etablissement." : "Aucune année scolaire courante n’est définie.");
    }

    return annee;
  }

  private async resolveExpirationDate(etablissementId: string): Promise<Date | null> {
    const etablissement = await this.prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { parametres_json: true },
    });
    const settings = this.asJsonObject(etablissement?.parametres_json);
    const draftSettings = this.asJsonObject(settings?.enrollment_drafts);
    const rawDays = draftSettings?.expiration_days ?? settings?.enrollment_draft_expiration_days;
    const days = Number(rawDays ?? 30);

    if (!Number.isFinite(days) || days <= 0) {
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.floor(days));
    return expiresAt;
  }

  private buildActiveUniqueKey(args: {
    tenantId: string;
    anneeScolaireId: string;
    eleveId?: string | null;
    draftType: DraftType;
    status: DraftStatus;
  }): string | null {
    if (!ACTIVE_STATUSES.includes(args.status) || !args.eleveId || args.draftType !== "RE_ENROLLMENT") {
      return null;
    }
    return [args.tenantId, args.anneeScolaireId, args.eleveId, args.draftType].join(":");
  }

  private computeCompletion(args: {
    studentData?: Record<string, unknown> | null;
    schoolingData?: Record<string, unknown> | null;
    guardiansData?: Record<string, unknown> | null;
  }) {
    const guardians = Array.isArray(args.guardiansData?.items)
      ? (args.guardiansData?.items as Array<Record<string, unknown>>)
      : Array.isArray(args.guardiansData?.tuteurs)
        ? (args.guardiansData?.tuteurs as Array<Record<string, unknown>>)
        : [];
    const firstGuardian = guardians[0] ?? {};
    const checks = [
      { key: "student.first_name", ok: Boolean(args.studentData?.prenom ?? args.studentData?.first_name) },
      { key: "student.last_name", ok: Boolean(args.studentData?.nom ?? args.studentData?.last_name) },
      { key: "schooling.level_or_class", ok: Boolean(args.schoolingData?.niveau_scolaire_id ?? args.schoolingData?.classe_id) },
      { key: "guardian.name", ok: Boolean(firstGuardian?.nom ?? firstGuardian?.nom_complet ?? firstGuardian?.name) },
      { key: "guardian.phone", ok: Boolean(firstGuardian?.telephone ?? firstGuardian?.phone) },
    ];
    const completed = checks.filter((item) => item.ok).length;

    return {
      completionRate: Math.round((completed / checks.length) * 100),
      missingFields: checks.filter((item) => !item.ok).map((item) => item.key),
    };
  }

  private normalizeSections(raw: Record<string, unknown>) {
    const studentData = this.asJsonObject(raw.student_data ?? raw.studentData ?? raw.eleve);
    const schoolingData = this.asJsonObject(raw.schooling_data ?? raw.schoolingData ?? raw.scolarite);
    const guardiansData = this.asJsonObject(raw.guardians_data ?? raw.guardiansData) ?? {
      items: Array.isArray(raw.tuteurs) ? raw.tuteurs : [],
    };

    return {
      student_data: studentData,
      schooling_data: schoolingData,
      guardians_data: guardiansData,
      finance_data: this.asJsonObject(raw.finance_data ?? raw.financeData ?? raw.finance),
      documents_data: this.asJsonObject(raw.documents_data ?? raw.documentsData) ?? {
        items: Array.isArray(raw.documents) ? raw.documents : [],
      },
      medical_data: this.asJsonObject(raw.medical_data ?? raw.medicalData ?? raw.medical),
      previous_school_data: this.asJsonObject(raw.previous_school_data ?? raw.previousSchoolData ?? raw.historique_scolaire),
      access_data: this.asJsonObject(raw.access_data ?? raw.accessData ?? raw.acces_systeme),
      consents_data: this.asJsonObject(raw.consents_data ?? raw.consentsData ?? raw.consentements),
      observations_data: this.asJsonObject(raw.observations_data ?? raw.observationsData ?? raw.observations),
      services_data: this.asJsonObject(raw.services_data ?? raw.servicesData ?? raw.services),
      payment_schedule_data: this.asJsonObject(raw.payment_schedule_data ?? raw.paymentScheduleData ?? raw.echeancier),
    };
  }

  private toNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    return value === null || value === undefined
      ? Prisma.JsonNull
      : value as Prisma.InputJsonValue;
  }

  private toDraftJsonData(sections: Record<string, unknown>) {
    return {
      student_data: this.toNullableJson(sections.student_data),
      schooling_data: this.toNullableJson(sections.schooling_data),
      guardians_data: this.toNullableJson(sections.guardians_data),
      finance_data: this.toNullableJson(sections.finance_data),
      documents_data: this.toNullableJson(sections.documents_data),
      medical_data: this.toNullableJson(sections.medical_data),
      previous_school_data: this.toNullableJson(sections.previous_school_data),
      access_data: this.toNullableJson(sections.access_data),
      consents_data: this.toNullableJson(sections.consents_data),
      observations_data: this.toNullableJson(sections.observations_data),
      services_data: this.toNullableJson(sections.services_data),
      payment_schedule_data: this.toNullableJson(sections.payment_schedule_data),
    };
  }

  private toFinalizationPayload(draft: any) {
    return {
      etablissement_id: draft.etablissement_id,
      annee_scolaire_id: draft.annee_scolaire_id,
      eleve: draft.student_data ?? {},
      scolarite: {
        ...(draft.schooling_data ?? {}),
        type_inscription:
          draft.draft_type === "RE_ENROLLMENT" ? "REINSCRIPTION" :
            draft.draft_type === "TRANSFER" ? "TRANSFERT_ENTRANT" :
              "NOUVELLE_INSCRIPTION",
      },
      tuteurs: Array.isArray(draft.guardians_data?.items)
        ? draft.guardians_data.items
        : Array.isArray(draft.guardians_data?.tuteurs)
          ? draft.guardians_data.tuteurs
          : [],
      documents: Array.isArray(draft.documents_data?.items) ? draft.documents_data.items : [],
      medical: draft.medical_data ?? {},
      historique_scolaire: draft.previous_school_data ?? {},
      acces_systeme: draft.access_data ?? {},
      consentements: draft.consents_data ?? {},
      observations: draft.observations_data ?? {},
      services: draft.services_data ?? {},
      finance: draft.finance_data ?? {},
      echeancier: draft.payment_schedule_data ?? {},
    };
  }

  private async createOfficialEnrollmentFromDraft(req: Request, draft: any) {
    const payload = this.toFinalizationPayload(draft);
    let statusCode = 200;
    let responsePayload: any = null;

    const fakeReq = {
      ...req,
      body: payload,
      tenantId: draft.etablissement_id,
      user: (req as Request & { user?: unknown }).user,
    } as unknown as Request;

    const fakeRes: any = {
      locals: {},
      headersSent: false,
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(data: any) {
        responsePayload = data;
        this.headersSent = true;
        return this;
      },
      setHeader() {
        return this;
      },
      end(data?: any) {
        responsePayload = data ?? responsePayload;
        this.headersSent = true;
        return this;
      },
    };

    await (this.inscriptionApp as any).createFull(fakeReq, fakeRes as R, (error?: unknown) => {
      if (error) {
        throw error;
      }
    });

    if (statusCode >= 400 || !responsePayload?.status?.success) {
      throw new Error(
        responsePayload?.status?.message ??
        responsePayload?.message ??
        "Erreur lors de l'inscription complete",
      );
    }

    const inscriptionId =
      typeof responsePayload?.data?.inscription?.id === "string"
        ? responsePayload.data.inscription.id
        : typeof responsePayload?.data?.id === "string"
          ? responsePayload.data.id
          : null;

    if (!inscriptionId) {
      throw new Error("Inscription creee, mais son identifiant est introuvable.");
    }

    return {
      inscriptionId,
      result: responsePayload.data,
    };
  }

  private async ensureOfficialEnrollmentDoesNotExist(eleveId: string, anneeScolaireId: string) {
    const existing = await this.prisma.inscription.findFirst({
      where: {
        eleve_id: eleveId,
        annee_scolaire_id: anneeScolaireId,
        statut: { notIn: ["ANNULEE", "SORTI"] as any },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Cet élève possède déjà une inscription active pour l’année scolaire courante.");
    }
  }

  private async loadDraftOrFail(id: string, tenantId: string) {
    const draft = await this.prisma.enrollmentDraft.findFirst({
      where: { id, etablissement_id: tenantId },
      include: {
        annee: { select: { id: true, nom: true } },
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        files: true,
      },
    });

    if (!draft) {
      throw new Error("Brouillon introuvable.");
    }

    return draft;
  }

  private buildScopedWhere(where: Record<string, unknown>, tenantId: string) {
    return { AND: [where ?? {}, { etablissement_id: tenantId }] };
  }

  private async create(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const draftType = this.normalizeDraftType(req.body?.draft_type ?? req.body?.draftType);
      const annee = await this.resolveActiveYear(tenantId, req.body?.annee_scolaire_id);
      const sections = this.normalizeSections(req.body ?? {});
      const eleveId = typeof req.body?.eleve_id === "string" && req.body.eleve_id.trim() ? req.body.eleve_id.trim() : null;

      if (draftType === "RE_ENROLLMENT" && eleveId) {
        await this.ensureOfficialEnrollmentDoesNotExist(eleveId, annee.id);
      }

      const completion = this.computeCompletion({
        studentData: sections.student_data,
        schoolingData: sections.schooling_data,
        guardiansData: sections.guardians_data,
      });
      const expiresAt = await this.resolveExpirationDate(tenantId);

      const result = await this.prisma.enrollmentDraft.create({
        data: {
          etablissement_id: tenantId,
          annee_scolaire_id: annee.id,
          eleve_id: eleveId,
          draft_type: draftType,
          status: completion.missingFields.length === 0 ? "READY_TO_SUBMIT" : "DRAFT",
          current_step: this.normalizeCurrentStep(req.body?.current_step),
          ...this.toDraftJsonData(sections),
          completion_rate: completion.completionRate,
          missing_fields: completion.missingFields,
          created_by_utilisateur_id: actorId,
          updated_by_utilisateur_id: actorId,
          active_unique_key: this.buildActiveUniqueKey({
            tenantId,
            anneeScolaireId: annee.id,
            eleveId,
            draftType,
            status: completion.missingFields.length === 0 ? "READY_TO_SUBMIT" : "DRAFT",
          }),
          expires_at: expiresAt,
        },
      });

      Response.success(res, "Brouillon créé avec succès.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la creation du brouillon.", 400, error as Error);
    }
  }

  private async getAll(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const includeSpec = req.query.includeSpec ?? JSON.stringify({
        annee: { select: { id: true, nom: true } },
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        createur: { include: { profil: true } },
      });
      const result = await getAllPaginated(
        {
          ...req.query,
          where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
          includeSpec,
          orderBy: req.query.orderBy ?? JSON.stringify([{ updated_at: "desc" }]),
        } as typeof req.query,
        this.draft,
      );
      Response.success(res, "Liste des brouillons récupérée.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des brouillons.", 400, error as Error);
    }
  }

  private async getOne(req: Request, res: R): Promise<void> {
    try {
      const draft = await this.loadDraftOrFail(req.params.id, this.resolveTenantId(req));
      Response.success(res, "Brouillon repris avec succès.", draft);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la recuperation du brouillon.", 404, error as Error);
    }
  }

  private async update(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const existing = await this.loadDraftOrFail(req.params.id, tenantId);
      if (["SUBMITTED", "DELETED"].includes(existing.status)) {
        throw new Error(existing.status === "SUBMITTED" ? "Ce brouillon a déjà été finalisé." : "Ce brouillon a été supprimé.");
      }

      const sections = this.normalizeSections(req.body ?? {});
      const completion = this.computeCompletion({
        studentData: sections.student_data,
        schoolingData: sections.schooling_data,
        guardiansData: sections.guardians_data,
      });
      const status: DraftStatus = completion.missingFields.length === 0 ? "READY_TO_SUBMIT" : "IN_PROGRESS";
      const eleveId = typeof req.body?.eleve_id === "string" && req.body.eleve_id.trim() ? req.body.eleve_id.trim() : existing.eleve_id;

      const result = await this.prisma.enrollmentDraft.update({
        where: { id: existing.id },
        data: {
          eleve_id: eleveId,
          status,
          current_step: this.normalizeCurrentStep(req.body?.current_step ?? existing.current_step),
          ...this.toDraftJsonData(sections),
          completion_rate: completion.completionRate,
          missing_fields: completion.missingFields,
          updated_by_utilisateur_id: actorId,
          active_unique_key: this.buildActiveUniqueKey({
            tenantId,
            anneeScolaireId: existing.annee_scolaire_id,
            eleveId,
            draftType: existing.draft_type as DraftType,
            status,
          }),
        },
      });

      Response.success(res, "Brouillon sauvegardé.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la sauvegarde du brouillon.", 400, error as Error);
    }
  }

  private async autosave(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const existing = await this.loadDraftOrFail(req.params.id, tenantId);
      if (["SUBMITTED", "DELETED", "EXPIRED"].includes(existing.status)) {
        throw new Error(
          existing.status === "SUBMITTED" ? "Ce brouillon a déjà été finalisé." :
            existing.status === "EXPIRED" ? "Ce brouillon est expiré." :
              "Ce brouillon a été supprimé.",
        );
      }

      const incoming = this.normalizeSections(req.body ?? {});
      const merged = {
        student_data: incoming.student_data ?? existing.student_data,
        schooling_data: incoming.schooling_data ?? existing.schooling_data,
        guardians_data: incoming.guardians_data ?? existing.guardians_data,
        finance_data: incoming.finance_data ?? existing.finance_data,
        documents_data: incoming.documents_data ?? existing.documents_data,
        medical_data: incoming.medical_data ?? existing.medical_data,
        previous_school_data: incoming.previous_school_data ?? existing.previous_school_data,
        access_data: incoming.access_data ?? existing.access_data,
        consents_data: incoming.consents_data ?? existing.consents_data,
        observations_data: incoming.observations_data ?? existing.observations_data,
        services_data: incoming.services_data ?? existing.services_data,
        payment_schedule_data: incoming.payment_schedule_data ?? existing.payment_schedule_data,
      };
      const completion = this.computeCompletion({
        studentData: this.asJsonObject(merged.student_data),
        schoolingData: this.asJsonObject(merged.schooling_data),
        guardiansData: this.asJsonObject(merged.guardians_data),
      });
      const status: DraftStatus = completion.missingFields.length === 0 ? "READY_TO_SUBMIT" : "IN_PROGRESS";

      const result = await this.prisma.enrollmentDraft.update({
        where: { id: existing.id },
        data: {
          ...this.toDraftJsonData(merged),
          status,
          current_step: this.normalizeCurrentStep(req.body?.current_step ?? existing.current_step),
          completion_rate: completion.completionRate,
          missing_fields: completion.missingFields,
          updated_by_utilisateur_id: actorId,
          active_unique_key: this.buildActiveUniqueKey({
            tenantId,
            anneeScolaireId: existing.annee_scolaire_id,
            eleveId: existing.eleve_id,
            draftType: existing.draft_type as DraftType,
            status,
          }),
        },
      });

      Response.success(res, "Brouillon sauvegardé.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la sauvegarde du brouillon.", 400, error as Error);
    }
  }

  private async delete(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.loadDraftOrFail(req.params.id, tenantId);
      if (existing.status === "SUBMITTED") {
        throw new Error("Impossible de supprimer un brouillon déjà finalisé.");
      }
      const result = await this.prisma.enrollmentDraft.update({
        where: { id: existing.id },
        data: {
          status: "DELETED",
          deleted_at: new Date(),
          active_unique_key: null,
          files: {
            updateMany: {
              where: { status: "TEMPORARY" },
              data: { status: "DELETED" },
            },
          },
        },
      });
      Response.success(res, "Brouillon supprimé avec succès.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la suppression du brouillon.", 400, error as Error);
    }
  }

  private async restore(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const existing = await this.loadDraftOrFail(req.params.id, tenantId);
      if (existing.status === "SUBMITTED") {
        throw new Error("Ce brouillon a déjà été finalisé.");
      }
      const status: DraftStatus = existing.missing_fields && Array.isArray(existing.missing_fields) && existing.missing_fields.length === 0
        ? "READY_TO_SUBMIT"
        : "IN_PROGRESS";
      const result = await this.prisma.enrollmentDraft.update({
        where: { id: existing.id },
        data: {
          status,
          deleted_at: null,
          updated_by_utilisateur_id: actorId,
          active_unique_key: this.buildActiveUniqueKey({
            tenantId,
            anneeScolaireId: existing.annee_scolaire_id,
            eleveId: existing.eleve_id,
            draftType: existing.draft_type as DraftType,
            status,
          }),
        },
      });
      Response.success(res, "Brouillon restauré avec succès.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la restauration du brouillon.", 400, error as Error);
    }
  }

  private async createFromStudent(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const annee = await this.resolveActiveYear(tenantId, req.body?.annee_scolaire_id);
      const studentId = req.params.studentId;

      await this.ensureOfficialEnrollmentDoesNotExist(studentId, annee.id);

      const eleve = await this.prisma.eleve.findFirst({
        where: { id: studentId, etablissement_id: tenantId },
        include: {
          utilisateur: { include: { profil: true } },
          liensParents: { include: { parent_tuteur: { include: { utilisateur: { include: { profil: true } } } } } },
          profilMedical: true,
          inscriptions: {
            orderBy: { created_at: "desc" },
            take: 1,
            include: { classe: { include: { niveau: true } }, niveau: true, historiqueScolaire: true },
          },
        },
      });

      if (!eleve) {
        throw new Error("Élève introuvable.");
      }

      const profil = eleve.utilisateur?.profil;
      const lastInscription = eleve.inscriptions[0] ?? null;
      const studentData = {
        eleve_id: eleve.id,
        code_eleve: eleve.code_eleve,
        prenom: profil?.prenom,
        nom: profil?.nom,
        date_naissance: profil?.date_naissance?.toISOString() ?? null,
        lieu_naissance: profil?.lieu_naissance,
        genre: profil?.genre,
        adresse: profil?.adresse,
      };
      const guardiansData = {
        items: eleve.liensParents.map((link) => ({
          parent_tuteur_id: link.parent_tuteur_id,
          nom_complet: link.parent_tuteur.nom_complet,
          telephone: link.parent_tuteur.telephone,
          email: link.parent_tuteur.email,
          relation: link.relation,
          est_principal: link.est_principal,
          est_responsable_legal: link.est_responsable_legal,
          est_responsable_financier: link.est_responsable_financier,
          est_contact_urgence: link.est_contact_urgence,
        })),
      };
      const schoolingData = {
        type_inscription: "REINSCRIPTION",
        niveau_scolaire_id: lastInscription?.classe?.niveau_scolaire_id ?? lastInscription?.niveau_scolaire_id,
        ...(this.asJsonObject(req.body?.schooling_data ?? req.body?.schoolingData ?? req.body?.scolarite) ?? {}),
      };
      const previousSchoolData = {
        ancienne_classe: lastInscription?.classe?.nom,
        ancien_niveau: lastInscription?.classe?.niveau?.nom ?? lastInscription?.niveau?.nom,
        inscription_precedente_id: lastInscription?.id,
        ancien_etablissement: lastInscription?.historiqueScolaire?.ancien_etablissement,
        annee_precedente: lastInscription?.historiqueScolaire?.annee_precedente,
        derniere_moyenne: lastInscription?.historiqueScolaire?.derniere_moyenne?.toString(),
        decision_precedente: lastInscription?.historiqueScolaire?.decision_precedente,
        mention_precedente: lastInscription?.historiqueScolaire?.mention_precedente,
        motif_transfert: lastInscription?.historiqueScolaire?.motif_transfert,
        observations: lastInscription?.historiqueScolaire?.observations,
      };
      const completion = this.computeCompletion({
        studentData,
        schoolingData,
        guardiansData,
      });
      const status: DraftStatus = completion.missingFields.length === 0 ? "READY_TO_SUBMIT" : "DRAFT";
      const expiresAt = await this.resolveExpirationDate(tenantId);

      const result = await this.prisma.enrollmentDraft.create({
        data: {
          etablissement_id: tenantId,
          annee_scolaire_id: annee.id,
          eleve_id: eleve.id,
          draft_type: "RE_ENROLLMENT",
          status,
          current_step: 1,
          student_data: studentData,
          schooling_data: schoolingData,
          guardians_data: guardiansData,
          medical_data: eleve.profilMedical
            ? {
                groupe_sanguin: eleve.profilMedical.groupe_sanguin,
                allergies: eleve.profilMedical.allergies,
                maladies_particulieres: eleve.profilMedical.maladies_particulieres,
                traitement_medical: eleve.profilMedical.traitement_medical,
                medecin_traitant: eleve.profilMedical.medecin_traitant,
                telephone_medecin: eleve.profilMedical.telephone_medecin,
                autorisation_prise_en_charge_medicale: eleve.profilMedical.autorisation_prise_en_charge_medicale,
                personne_a_contacter_urgence: eleve.profilMedical.personne_a_contacter_urgence,
                telephone_urgence: eleve.profilMedical.telephone_urgence,
                notes_json: eleve.profilMedical.notes_json,
              }
            : {},
          previous_school_data: previousSchoolData,
          completion_rate: completion.completionRate,
          missing_fields: completion.missingFields,
          created_by_utilisateur_id: actorId,
          updated_by_utilisateur_id: actorId,
          active_unique_key: this.buildActiveUniqueKey({
            tenantId,
            anneeScolaireId: annee.id,
            eleveId: eleve.id,
            draftType: "RE_ENROLLMENT",
            status,
          }),
          expires_at: expiresAt,
        },
      });

      Response.success(res, "Brouillon de réinscription créé avec succès.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la creation du brouillon de reinscription.", 400, error as Error);
    }
  }

  private async getSummary(req: Request, res: R): Promise<void> {
    try {
      const draft = await this.loadDraftOrFail(req.params.id, this.resolveTenantId(req));
      Response.success(res, "Résumé du brouillon.", {
        draft,
        finalization_payload: this.toFinalizationPayload(draft),
      });
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la recuperation du resume du brouillon.", 404, error as Error);
    }
  }

  private async prepareSubmit(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const draft = await this.loadDraftOrFail(req.params.id, tenantId);
      if (draft.status === "SUBMITTED") {
        throw new Error("Ce brouillon a déjà été finalisé.");
      }
      if (draft.status === "EXPIRED") {
        throw new Error("Ce brouillon est expiré.");
      }
      if (draft.status === "DELETED") {
        throw new Error("Ce brouillon a été supprimé.");
      }

      const completion = this.computeCompletion({
        studentData: this.asJsonObject(draft.student_data),
        schoolingData: this.asJsonObject(draft.schooling_data),
        guardiansData: this.asJsonObject(draft.guardians_data),
      });
      if (completion.missingFields.length > 0) {
        await this.prisma.enrollmentDraft.update({
          where: { id: draft.id },
          data: {
            status: "IN_PROGRESS",
            completion_rate: completion.completionRate,
            missing_fields: completion.missingFields,
          },
        });
        throw new Error("Impossible de finaliser : des champs obligatoires sont manquants.");
      }

      const preparedDraft = await this.prisma.enrollmentDraft.update({
        where: { id: draft.id },
        data: {
          status: "READY_TO_SUBMIT",
          completion_rate: completion.completionRate,
          missing_fields: completion.missingFields,
        },
        include: {
          annee: { select: { id: true, nom: true } },
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          files: true,
        },
      });

      const official = await this.createOfficialEnrollmentFromDraft(req, preparedDraft);
      const submittedDraft = await this.prisma.enrollmentDraft.update({
        where: { id: preparedDraft.id },
        data: {
          status: "SUBMITTED",
          submitted_inscription_id: official.inscriptionId,
          submitted_at: new Date(),
          updated_by_utilisateur_id: actorId,
          active_unique_key: null,
          files: {
            updateMany: {
              where: { status: "TEMPORARY" },
              data: { status: "ATTACHED_TO_ENROLLMENT" },
            },
          },
        },
      });

      Response.success(res, preparedDraft.draft_type === "RE_ENROLLMENT" ? "Réinscription finalisée avec succès." : "Inscription finalisée avec succès.", {
        draft: submittedDraft,
        inscription: official.result.inscription ?? official.result,
        result: official.result,
      });
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la preparation de la finalisation.", 400, error as Error);
    }
  }

  private async markSubmitted(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const draft = await this.loadDraftOrFail(req.params.id, tenantId);
      if (draft.status === "SUBMITTED") {
        throw new Error("Ce brouillon a déjà été finalisé.");
      }
      if (draft.status === "DELETED") {
        throw new Error("Ce brouillon a été supprimé.");
      }

      const submittedInscriptionId =
        typeof req.body?.submitted_inscription_id === "string" && req.body.submitted_inscription_id.trim()
          ? req.body.submitted_inscription_id.trim()
          : typeof req.body?.inscription_id === "string" && req.body.inscription_id.trim()
            ? req.body.inscription_id.trim()
            : null;

      if (!submittedInscriptionId) {
        throw new Error("L'inscription finalisée est obligatoire.");
      }

      const inscription = await this.prisma.inscription.findFirst({
        where: {
          id: submittedInscriptionId,
          annee: { etablissement_id: tenantId },
        },
        select: { id: true },
      });

      if (!inscription) {
        throw new Error("Inscription finalisée introuvable pour cet établissement.");
      }

      const result = await this.prisma.enrollmentDraft.update({
        where: { id: draft.id },
        data: {
          status: "SUBMITTED",
          submitted_inscription_id: submittedInscriptionId,
          submitted_at: new Date(),
          updated_by_utilisateur_id: actorId,
          active_unique_key: null,
          files: {
            updateMany: {
              where: { status: "TEMPORARY" },
              data: { status: "ATTACHED_TO_ENROLLMENT" },
            },
          },
        },
      });

      Response.success(res, "Inscription finalisée avec succès.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la finalisation du brouillon.", 400, error as Error);
    }
  }

  private async createFile(req: Request, res: R): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.getActorId(req);
      const draft = await this.loadDraftOrFail(req.params.id, tenantId);
      if (["SUBMITTED", "DELETED"].includes(draft.status)) {
        throw new Error("Impossible d'ajouter un fichier sur ce brouillon.");
      }
      const filename = typeof req.body?.filename === "string" ? req.body.filename.trim() : "";
      if (!filename) {
        throw new Error("Le nom du fichier est obligatoire.");
      }

      const result = await this.prisma.enrollmentDraftFile.create({
        data: {
          draft_id: draft.id,
          document_type_id: typeof req.body?.document_type_id === "string" ? req.body.document_type_id : null,
          fichier_id: typeof req.body?.fichier_id === "string" ? req.body.fichier_id : null,
          filename,
          original_name: typeof req.body?.original_name === "string" ? req.body.original_name : filename,
          mime_type: typeof req.body?.mime_type === "string" ? req.body.mime_type : null,
          size: Number.isFinite(Number(req.body?.size)) ? Number(req.body.size) : null,
          path: typeof req.body?.path === "string" ? req.body.path : null,
          uploaded_by_id: actorId,
        },
      });

      Response.success(res, "Fichier de brouillon ajouté.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de l'ajout du fichier.", 400, error as Error);
    }
  }

  private async getFiles(req: Request, res: R): Promise<void> {
    try {
      const draft = await this.loadDraftOrFail(req.params.id, this.resolveTenantId(req));
      const files = await this.prisma.enrollmentDraftFile.findMany({
        where: { draft_id: draft.id, status: { not: "DELETED" } },
        include: { documentType: true, fichier: true },
        orderBy: { created_at: "desc" },
      });
      Response.success(res, "Fichiers du brouillon récupérés.", files);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la recuperation des fichiers.", 400, error as Error);
    }
  }

  private async deleteFile(req: Request, res: R): Promise<void> {
    try {
      const draft = await this.loadDraftOrFail(req.params.id, this.resolveTenantId(req));
      const file = await this.prisma.enrollmentDraftFile.findFirst({
        where: { id: req.params.fileId, draft_id: draft.id },
      });
      if (!file) {
        throw new Error("Fichier de brouillon introuvable.");
      }
      const result = await this.prisma.enrollmentDraftFile.update({
        where: { id: file.id },
        data: { status: "DELETED" },
      });
      Response.success(res, "Fichier de brouillon supprimé.", result);
    } catch (error) {
      Response.error(res, (error as Error).message || "Erreur lors de la suppression du fichier.", 400, error as Error);
    }
  }
}

export default EnrollmentDraftApp;
