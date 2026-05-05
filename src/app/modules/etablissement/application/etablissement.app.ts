import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import EtablissementModel from "../models/etablissement.model";
import { Etablissement, Prisma } from "@prisma/client";
import Code from "../../../common/app/code";
import { getAllPaginated } from "../../../common/utils/functions";

class EtablissementApp {
    public app: Application;
    public router: Router;
    private etablissement: EtablissementModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.etablissement = new EtablissementModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/current/enrollment-finance-policy', this.getCurrentEnrollmentFinancePolicy.bind(this));
        this.router.put('/current/enrollment-finance-policy', this.updateCurrentEnrollmentFinancePolicy.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.get('/by-code/:code', this.getByCode.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Etablissement = req.body;
            //récupération de la dernière ligne
            const lastLine: Etablissement = await this.etablissement.findLast();
            //générer un code
            const code = new Code("ET", 3, lastLine?.code as string);
            //affectation du code
            data.code = code.next();
            data.fuseau_horaire = "Indian/Antananarivo";
            const result = await this.etablissement.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.etablissement);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.etablissement.findUnique(id);
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getByCode(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const code: string = req.params.code;
            const result = await this.etablissement.findByCondition({ code });
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.etablissement.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Etablissement = req.body;
            const result = await this.etablissement.update(id, data);
            Response.success(res, "Stablisment updated.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getCurrentEnrollmentFinancePolicy(req: Request, res: R): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const etablissement = await this.etablissement.findUnique<Etablissement>(tenantId);
            if (!etablissement) {
                Response.error(res, "Etablissement introuvable.", 404, new Error("Etablissement introuvable."));
                return;
            }

            Response.success(
                res,
                "Politique de paiement minimum recuperee.",
                {
                    etablissement_id: etablissement.id,
                    ...this.resolveEnrollmentFinancePolicy(etablissement.parametres_json ?? null),
                },
            );
        } catch (error) {
            Response.error(
                res,
                "Impossible de recuperer la politique de paiement minimum.",
                400,
                error as Error,
            );
        }
    }

    private async updateCurrentEnrollmentFinancePolicy(req: Request, res: R): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const etablissement = await this.etablissement.findUnique<Etablissement>(tenantId);
            if (!etablissement) {
                Response.error(res, "Etablissement introuvable.", 404, new Error("Etablissement introuvable."));
                return;
            }

            const nextPolicy = this.normalizeEnrollmentFinancePolicyPayload(req.body);
            const parametres_json = this.mergeEnrollmentFinancePolicy(
                etablissement.parametres_json ?? null,
                nextPolicy,
            );

            const result = await this.etablissement.update(tenantId, {
                parametres_json,
            } as Partial<Etablissement>);

            Response.success(
                res,
                "Politique de paiement minimum mise a jour.",
                {
                    etablissement_id: result.id,
                    ...nextPolicy,
                },
            );
        } catch (error) {
            Response.error(
                res,
                "Impossible de mettre a jour la politique de paiement minimum.",
                400,
                error as Error,
            );
        }
    }

    private resolveTenantId(req: Request) {
        const tenantId = (req as Request & { tenantId?: string }).tenantId?.trim();
        if (!tenantId) {
            throw new Error("Aucun etablissement actif n'a ete fourni.");
        }
        return tenantId;
    }

    private extractJsonObject(value: Prisma.JsonValue | null | undefined) {
        return value && typeof value === "object" && !Array.isArray(value)
            ? ({ ...(value as Record<string, unknown>) } as Record<string, unknown>)
            : null;
    }

    private getNestedJsonObject(parent: Record<string, unknown> | null, key: string) {
        const value = parent?.[key];
        return value && typeof value === "object" && !Array.isArray(value)
            ? ({ ...(value as Record<string, unknown>) } as Record<string, unknown>)
            : null;
    }

    private toNullableString(value: unknown) {
        if (typeof value !== "string") return null;
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
    }

    private resolveEnrollmentFinancePolicy(parametres: Prisma.JsonValue | null | undefined) {
        const root = this.extractJsonObject(parametres);
        const financeSettings = this.getNestedJsonObject(root, "finance");
        const enrollmentSettings =
            this.getNestedJsonObject(financeSettings, "inscription") ??
            this.getNestedJsonObject(financeSettings, "enrollment") ??
            this.getNestedJsonObject(root, "inscription") ??
            this.getNestedJsonObject(root, "enrollment");
        const validationSettings =
            this.getNestedJsonObject(enrollmentSettings, "validation") ??
            this.getNestedJsonObject(enrollmentSettings, "validation_financiere") ??
            enrollmentSettings;

        const minimumMode = this.toNullableString(
            validationSettings?.minimum_payment_mode ??
            validationSettings?.mode_paiement_minimum ??
            validationSettings?.minimum_required_payment_mode,
        )?.toUpperCase();
        const minimumPercent = Number(
            validationSettings?.minimum_payment_percent ??
            validationSettings?.pourcentage_paiement_minimum ??
            validationSettings?.minimum_required_payment_percent ??
            0,
        );
        const minimumAmount = Number(
            validationSettings?.minimum_payment_amount ??
            validationSettings?.montant_paiement_minimum ??
            validationSettings?.minimum_required_payment_amount ??
            0,
        );
        const dueSoonDaysCandidate = Number(
            validationSettings?.echeance_proche_jours ??
            validationSettings?.due_soon_days ??
            financeSettings?.echeance_proche_jours ??
            7,
        );

        const normalizedMode =
            minimumMode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE" ||
            minimumMode === "REGISTRATION_AND_FIRST_TUITION_INSTALLMENT" ||
            minimumMode === "DROIT_INSCRIPTION_ET_PREMIERE_TRANCHE_SCOLARITE"
                ? "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE"
                : minimumMode === "INSCRIPTION_FEE" ||
                    minimumMode === "REGISTRATION_FEE" ||
                    minimumMode === "DROIT_INSCRIPTION"
                    ? "INSCRIPTION_FEE"
                    : minimumMode === "AMOUNT" || minimumAmount > 0
                        ? "AMOUNT"
                        : minimumMode === "PERCENT" || minimumPercent > 0
                            ? "PERCENT"
                            : "NONE";

        return {
            mode: normalizedMode as "NONE" | "PERCENT" | "AMOUNT" | "INSCRIPTION_FEE" | "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE",
            value:
                normalizedMode === "AMOUNT"
                    ? Math.max(0, minimumAmount)
                    : normalizedMode === "PERCENT"
                        ? Math.max(0, Math.min(100, minimumPercent))
                        : 0,
            due_soon_days: Number.isFinite(dueSoonDaysCandidate)
                ? Math.max(1, Math.trunc(dueSoonDaysCandidate))
                : 7,
        };
    }

    private normalizeEnrollmentFinancePolicyPayload(payload: unknown) {
        const body =
            payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>)
                : {};
        const mode = this.toNullableString(body.mode)?.toUpperCase() ?? "NONE";
        if (!["NONE", "PERCENT", "AMOUNT", "INSCRIPTION_FEE", "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE"].includes(mode)) {
            throw new Error("Le mode de paiement minimum est invalide.");
        }

        const valueCandidate = Number(body.value ?? 0);
        if (!Number.isFinite(valueCandidate) || valueCandidate < 0) {
            throw new Error("La valeur du paiement minimum est invalide.");
        }

        const dueSoonDaysCandidate = Number(body.due_soon_days ?? body.dueSoonDays ?? 7);
        if (!Number.isFinite(dueSoonDaysCandidate) || dueSoonDaysCandidate <= 0) {
            throw new Error("Le seuil des echeances proches est invalide.");
        }

        if (mode === "PERCENT" && valueCandidate > 100) {
            throw new Error("Le pourcentage du paiement minimum doit etre compris entre 0 et 100.");
        }

        return {
            mode: mode as "NONE" | "PERCENT" | "AMOUNT" | "INSCRIPTION_FEE" | "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE",
            value: ["NONE", "INSCRIPTION_FEE", "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE"].includes(mode) ? 0 : valueCandidate,
            due_soon_days: Math.trunc(dueSoonDaysCandidate),
        };
    }

    private mergeEnrollmentFinancePolicy(
        parametres: Prisma.JsonValue | null | undefined,
        policy: ReturnType<EtablissementApp["normalizeEnrollmentFinancePolicyPayload"]>,
    ) {
        const root = this.extractJsonObject(parametres) ?? {};
        const financeSettings = this.getNestedJsonObject(root, "finance") ?? {};
        const enrollmentSettings = this.getNestedJsonObject(financeSettings, "inscription") ?? {};
        const validationSettings = this.getNestedJsonObject(enrollmentSettings, "validation") ?? {};

        validationSettings.minimum_payment_mode = policy.mode;
        validationSettings.minimum_payment_percent = policy.mode === "PERCENT" ? policy.value : 0;
        validationSettings.minimum_payment_amount = policy.mode === "AMOUNT" ? policy.value : 0;
        validationSettings.echeance_proche_jours = policy.due_soon_days;

        enrollmentSettings.validation = validationSettings;
        financeSettings.inscription = enrollmentSettings;
        financeSettings.echeance_proche_jours = policy.due_soon_days;
        root.finance = financeSettings;

        return root;
    }
};

export default EtablissementApp;
