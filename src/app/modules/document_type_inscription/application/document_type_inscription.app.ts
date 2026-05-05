import { Prisma } from "@prisma/client";
import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import { parseBool, parseJSON, parseNumber } from "../../../common/utils/query";
import { mergeScopedWhere, resolveTenantContext, type TenantScopedRequest } from "../../../common/utils/requestTenantScope";
import { prisma } from "../../../service/prisma";
import DocumentTypeInscriptionModel from "../models/document_type_inscription.model";

const INSCRIPTION_TYPES = new Set([
    "NOUVELLE_INSCRIPTION",
    "REINSCRIPTION",
    "TRANSFERT_ENTRANT",
    "REDOUBLEMENT",
    "PASSAGE_CLASSE_SUPERIEURE",
]);

class DocumentTypeInscriptionApp {
    public app: Application;
    public router: Router;
    private documentTypeInscription: DocumentTypeInscriptionModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.documentTypeInscription = new DocumentTypeInscriptionModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.put("/:id", this.update.bind(this));
        this.router.delete("/:id", this.delete.bind(this));
        this.router.post("/:id/clone", this.clone.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const data = this.normalizePayload(req.body);
            const result = await this.documentTypeInscription.create({
                ...data,
                etablissement_id: tenantId,
            });

            Response.success(res, "Type de document cree avec succes.", result);
        } catch (error) {
            Response.error(
                res,
                "Le type de document n'a pas pu etre cree.",
                400,
                error as Error,
            );
        }
    }

    private async getAll(req: Request, res: R): Promise<void> {
        try {
            const tenant = resolveTenantContext(req as TenantScopedRequest);
            if (!tenant.ok) {
                return Response.error(res, tenant.message, tenant.statusCode, new Error(tenant.message));
            }

            const page = parseNumber(req.query.page, 1) ?? 1;
            const take = parseNumber(req.query.take, 10) ?? 10;
            const orderBy = parseJSON<any>(
                req.query.orderBy,
                [{ ordre: "asc" }, { nom: "asc" }],
            );
            const select = parseJSON<object>(req.query.select, null);
            const include = parseJSON<object>(req.query.includeSpec, null);
            const includeTotal = parseBool(req.query.includeTotal, true);

            const scopedWhere = mergeScopedWhere(tenant.queryWhere, {
                OR: [
                    { etablissement_id: tenant.tenantId },
                    { etablissement_id: null },
                ],
            });

            const result = await this.documentTypeInscription.findManyPaginated({
                page,
                take,
                where: scopedWhere,
                orderBy: orderBy ?? [{ ordre: "asc" }, { nom: "asc" }],
                select: select ?? undefined,
                includeSpec: include ?? undefined,
                includeTotal,
                maxTake: 5000,
            });

            Response.success(res, "Types de documents recuperes avec succes.", result);
        } catch (error) {
            Response.error(
                res,
                "Les types de documents n'ont pas pu etre recuperes.",
                400,
                error as Error,
            );
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const item = await this.requireAccessibleRecord(req.params.id, tenantId);
            Response.success(res, "Type de document charge.", item);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const existing = await this.requireTenantOwnedRecord(req.params.id, tenantId);
            const data = this.normalizePayload(req.body, existing.code);

            const result = await this.documentTypeInscription.update(existing.id, {
                ...data,
                etablissement_id: tenantId,
            });

            Response.success(res, "Type de document mis a jour avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const existing = await this.requireTenantOwnedRecord(req.params.id, tenantId);
            const result = await this.documentTypeInscription.delete(existing.id);
            Response.success(res, "Type de document supprime avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private async clone(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const source = await this.requireAccessibleRecord(req.params.id, tenantId);

            const existing = await prisma.documentTypeInscription.findFirst({
                where: {
                    etablissement_id: tenantId,
                    code: source.code,
                },
            });

            if (existing) {
                throw new Error("Un type de document avec ce code existe deja pour cet etablissement.");
            }

            const result = await prisma.documentTypeInscription.create({
                data: {
                    etablissement_id: tenantId,
                    code: source.code,
                    nom: source.nom,
                    description: source.description,
                    type_inscriptions_json:
                        source.type_inscriptions_json === null
                            ? Prisma.JsonNull
                            : source.type_inscriptions_json,
                    est_obligatoire_par_defaut: source.est_obligatoire_par_defaut,
                    est_actif: source.est_actif,
                    ordre: source.ordre,
                },
            });

            Response.success(res, "Type de document clone avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private resolveTenantId(req: Request) {
        const tenantId = (req as Request & { tenantId?: string }).tenantId?.trim();
        if (!tenantId) {
            throw new Error("Aucun etablissement actif n'a ete fourni.");
        }
        return tenantId;
    }

    private async requireAccessibleRecord(id: string, tenantId: string) {
        const item = await prisma.documentTypeInscription.findUnique({
            where: { id },
        });

        if (!item) {
            throw new Error("Type de document introuvable.");
        }

        if (item.etablissement_id && item.etablissement_id !== tenantId) {
            throw new Error("Ce type de document n'est pas accessible pour cet etablissement.");
        }

        return item;
    }

    private async requireTenantOwnedRecord(id: string, tenantId: string) {
        const item = await this.requireAccessibleRecord(id, tenantId);
        if (item.etablissement_id !== tenantId) {
            throw new Error("Les types de documents globaux ne peuvent pas etre modifies ici.");
        }
        return item;
    }

    private normalizePayload(
        raw: unknown,
        fallbackCode?: string,
    ): Prisma.DocumentTypeInscriptionUncheckedCreateInput {
        const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const code = this.normalizeCode(input.code ?? fallbackCode);
        const nom = this.toRequiredString(input.nom, "Le nom du document est obligatoire.");
        const description = this.toNullableString(input.description);
        const typeInscriptionList = this.normalizeInscriptionTypes(input.type_inscriptions_json);
        const obligatoire = Boolean(input.est_obligatoire_par_defaut);
        const actif = input.est_actif === undefined ? true : Boolean(input.est_actif);
        const ordre = this.toNullableInt(input.ordre);

        return {
            code,
            nom,
            description,
            type_inscriptions_json: typeInscriptionList?.length ? typeInscriptionList : Prisma.JsonNull,
            est_obligatoire_par_defaut: obligatoire,
            est_actif: actif,
            ordre,
        };
    }

    private normalizeCode(value: unknown) {
        const source = this.toRequiredString(value, "Le code du document est obligatoire.");
        return source
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^A-Za-z0-9_]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .toUpperCase();
    }

    private normalizeInscriptionTypes(value: unknown) {
        if (value == null || value === "") {
            return null;
        }

        const rawList = Array.isArray(value)
            ? value
            : typeof value === "string"
                ? value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : [];

        const normalized = Array.from(
            new Set(
                rawList
                    .map((item) => String(item).trim().toUpperCase())
                    .filter(Boolean),
            ),
        );

        for (const type of normalized) {
            if (!INSCRIPTION_TYPES.has(type)) {
                throw new Error(`Type d'inscription invalide: ${type}`);
            }
        }

        return normalized;
    }

    private toRequiredString(value: unknown, message: string) {
        const normalized = this.toNullableString(value);
        if (!normalized) {
            throw new Error(message);
        }
        return normalized;
    }

    private toNullableString(value: unknown) {
        if (typeof value !== "string") {
            return value == null ? null : String(value).trim() || null;
        }

        const normalized = value.trim();
        return normalized.length ? normalized : null;
    }

    private toNullableInt(value: unknown) {
        if (value == null || value === "") {
            return null;
        }

        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            throw new Error("L'ordre doit etre un nombre valide.");
        }

        return Math.trunc(numberValue);
    }
}

export default DocumentTypeInscriptionApp;
