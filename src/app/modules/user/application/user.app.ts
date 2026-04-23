/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import UserModel from "../models/user.model";
import bcrypt from "bcrypt";
import Utils from "../../../utils";
import Response from "../../../common/app/response";
import { Prisma, PrismaClient, StatutCompte, Utilisateur } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import Code from "../../../common/app/code";
import {
  mergeScopedWhere,
  resolveTenantContext,
  type TenantScopedRequest,
} from "../../../common/utils/requestTenantScope";
import {
  extractRoleNamesFromUser,
  hasSystemAdminRoleNames,
} from "../../../service/sessionPolicy";
import { prisma } from "../../../service/prisma";
import { sanitizeUserResponse } from "./user.sanitizer";

type CreateAccountFromLinkPayload = {
  etablissement_id?: string | null;
  role_id?: string | null;
  utilisateur?: Pick<Utilisateur, "email" | "telephone" | "mot_de_passe_hash">;
  profil?: {
    prenom?: string;
    nom?: string;
    date_naissance?: Date | string | null;
    genre?: string | null;
    adresse?: string | null;
  };
};

type OwnerProvisioningPayload = {
  etablissement?: {
    nom?: string | null;
  } | null;
  utilisateur?: {
    email?: string | null;
    telephone?: string | null;
    mot_de_passe_hash?: string | null;
  } | null;
  profil?: {
    prenom?: string | null;
    nom?: string | null;
    date_naissance?: Date | string | null;
    genre?: string | null;
    adresse?: string | null;
  } | null;
};

type NormalizedOwnerProvisioningInput = {
  etablissementNom: string;
  email: string;
  telephone: string | null;
  password: string | null;
  profilPrenom: string;
  profilNom: string;
  profilDateNaissance: Date | string | null;
  profilGenre: string | null;
  profilAdresse: string | null;
};

type OwnerRegistrationLifecycleStatus = "PENDING" | "APPROVED" | "REJECTED";

type OwnerRegistrationScopeData = {
  status: OwnerRegistrationLifecycleStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  etablissement: {
    id?: string | null;
    nom?: string | null;
    code?: string | null;
  } | null;
  data: OwnerProvisioningPayload | null;
};

const OWNER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseScopeObject(rawScope: unknown): Record<string, unknown> | null {
  if (!rawScope) return null;

  if (typeof rawScope === "string") {
    try {
      const parsed = JSON.parse(rawScope);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawScope === "object"
    ? (rawScope as Record<string, unknown>)
    : null;
}

function resolveSystemRoleName(
  roleName?: string | null,
  scope?: unknown,
): string | null {
  const scopeObject = parseScopeObject(scope);
  const template =
    typeof scopeObject?.role_template === "string"
      ? scopeObject.role_template.trim().toUpperCase()
      : "";
  const normalizedRoleName = roleName?.trim().toUpperCase() ?? "";

  return template || normalizedRoleName || null;
}

class UserApp {
  public app: Application;
  public router: Router;
  private user: UserModel;
  private readonly identityInclude: Prisma.UtilisateurInclude;

  constructor(app: Application) {
    this.app = app;
    this.user = new UserModel();
    this.router = Router();
    this.identityInclude = {
      roles: {
        include: {
          role: true,
        },
      },
      profil: true,
      etablissement: true,
    };
    this.routes();
  }

  public routes(): Router {
    this.router.post("/create", this.createUser.bind(this));
    this.router.post(
      "/create-owner-registration",
      this.createOwnerRegistration.bind(this),
    );
    this.router.post("/create-owner-by-admin", this.createOwnerByAdmin.bind(this));
    this.router.post("/create-from-link", this.createAccountFromLink.bind(this));
    this.router.post(
      "/:id/approve-owner-registration",
      this.approveOwnerRegistration.bind(this),
    );
    this.router.post(
      "/:id/reject-owner-registration",
      this.rejectOwnerRegistration.bind(this),
    );
    this.router.post(
      "/owner-registration-status",
      this.getOwnerRegistrationStatus.bind(this),
    );
    this.router.put("/:id", this.updateUser.bind(this));
    this.router.delete("/:id", this.deleteUser.bind(this));
    this.router.get(
      "/pending-owner-registrations",
      this.getPendingOwnerRegistrations.bind(this),
    );
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:email", this.getUserByEmail.bind(this));
    return this.router;
  }

  private resolveTenant(req: TenantScopedRequest) {
    return resolveTenantContext(req, {
      allowBodyTenant: true,
      missingMessage: "Aucun etablissement actif n'a ete fourni pour les utilisateurs.",
      conflictMessage: "Conflit d'etablissement detecte pour les utilisateurs.",
    });
  }

  private async getScopedUserById(id: string, tenantId: string) {
    return prisma.utilisateur.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
      include: this.identityInclude,
    });
  }

  private async getScopedUserByEmail(email: string, tenantId: string) {
    return prisma.utilisateur.findFirst({
      where: {
        email,
        etablissement_id: tenantId,
      },
      include: this.identityInclude,
    });
  }

  private async getUserByEmail(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const result = await this.getScopedUserByEmail(req.params.email as string, tenant.tenantId);
      if (!result) {
        Response.error(
          res,
          "Utilisateur introuvable dans cet etablissement.",
          404,
          new Error("user not found"),
        );
        return;
      }

      Response.success(res, "Data user.", sanitizeUserResponse(result))
    } catch (error) {
      next(error);
    }
  }

  private async createOwnerRegistration(
    req: Request,
    res: R,
  ): Promise<void> {
    try {
      const input = this.normalizeOwnerProvisioningInput(
        req.body as OwnerProvisioningPayload,
        true,
      );

      const result = await prisma.$transaction((tx) =>
        this.withOwnerEmailLock(tx, input.email, async () => {
          await this.assertOwnerEmailAvailable(input.email, { tx });

          return tx.utilisateur.create({
            data: {
              etablissement_id: null,
              email: input.email,
              telephone: input.telephone,
              mot_de_passe_hash: await bcrypt.hash(input.password as string, 10),
              statut: StatutCompte.INACTIF,
              scope_json: this.buildPendingOwnerRegistrationScope(input),
            },
            select: {
              id: true,
              email: true,
              statut: true,
              created_at: true,
            },
          });
        }),
      );

      Response.success(
        res,
        "Demande proprietaire enregistree avec succes.",
        result,
      );
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async createOwnerByAdmin(
    req: Request,
    res: R,
  ): Promise<void> {
    try {
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub?.trim() ?? null;

      if (!actorId) {
        return Response.error(
          res,
          "Authentification requise pour creer un etablissement.",
          401,
          new Error("missing actor"),
        );
      }

      const isAdmin = await this.userHasSystemAdminRole(actorId);
      if (!isAdmin) {
        return Response.error(
          res,
          "Seul un administrateur systeme peut creer un etablissement avec son proprietaire.",
          403,
          new Error("forbidden"),
        );
      }

      const input = this.normalizeOwnerProvisioningInput(
        req.body as OwnerProvisioningPayload,
        true,
      );

      const result = await prisma.$transaction((tx) =>
        this.withOwnerEmailLock(tx, input.email, async () => {
          await this.assertOwnerEmailAvailable(input.email, { tx });
          return this.provisionOwnerEstablishment(tx, input);
        }),
      );

      Response.success(res, "Etablissement et proprietaire crees avec succes.", result);
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      req.query.where = JSON.stringify(
        mergeScopedWhere(tenant.queryWhere, { etablissement_id: tenant.tenantId }),
      );

      const result = await getAllPaginated(req.query, this.user);
      Response.success(res, "Data user.", sanitizeUserResponse(result))
    } catch (error) {
      next(error);
    }
  }

  private async createUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const body: Utilisateur = req.body;
      const userData: Utilisateur = {
        ...body,
        etablissement_id: tenant.tenantId,
        mot_de_passe_hash: await bcrypt.hash(body.mot_de_passe_hash as string, 10),
      }
      const result: object = await this.user.create(userData);
      Response.success(res, "user created successfully", sanitizeUserResponse(result))
    } catch (error) {
      next(error);
    }
  }

  private async createAccountFromLink(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateAccountFromLinkPayload;
      const etablissementId = body.etablissement_id?.trim();
      const roleId = body.role_id?.trim();
      const email = body.utilisateur?.email?.trim();
      const password = body.utilisateur?.mot_de_passe_hash?.trim();
      const prenom = body.profil?.prenom?.trim();
      const nom = body.profil?.nom?.trim();

      if (!etablissementId || !roleId) {
        return Response.error(
          res,
          "Le lien de creation est incomplet.",
          400,
          new Error("missing etablissement_id or role_id"),
        );
      }

      if (!email || !password) {
        return Response.error(
          res,
          "L'email et le mot de passe sont obligatoires.",
          400,
          new Error("missing credentials"),
        );
      }

      if (!prenom || !nom) {
        return Response.error(
          res,
          "Le prenom et le nom sont obligatoires pour creer le profil.",
          400,
          new Error("missing profile name"),
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        const role = await tx.role.findUnique({
          where: { id: roleId },
          select: { id: true, nom: true, etablissement_id: true, scope_json: true },
        });

        if (!role) {
          throw new Error("Le role du lien est introuvable.");
        }

        if (role.etablissement_id && role.etablissement_id !== etablissementId) {
          throw new Error("Le role du lien ne correspond pas a cet etablissement.");
        }

        const createdUser = await tx.utilisateur.create({
          data: {
            etablissement_id: etablissementId,
            email,
            telephone: body.utilisateur?.telephone?.trim() || null,
            mot_de_passe_hash: hashedPassword,
            statut: StatutCompte.ACTIF,
          },
        });

        const createdProfile = await tx.profil.create({
          data: {
            utilisateur_id: createdUser.id,
            prenom,
            nom,
            date_naissance: this.toDateOrNull(body.profil?.date_naissance),
            genre: body.profil?.genre?.trim() || null,
            adresse: body.profil?.adresse?.trim() || null,
          },
        });

        await tx.utilisateurRole.create({
          data: {
            utilisateur_id: createdUser.id,
            role_id: role.id,
          },
        });

        const normalizedRoleName = resolveSystemRoleName(role.nom, role.scope_json);
        const shouldCreatePersonnel = true;
        const shouldCreateEnseignant = normalizedRoleName === "ENSEIGNANT";

        let createdPersonnel: { id: string; code_personnel: string | null } | null = null;
        let createdEnseignant: { id: string } | null = null;

        if (shouldCreatePersonnel) {
          const lastPersonnel = await tx.personnel.findFirst({
            where: { etablissement_id: etablissementId },
            orderBy: { created_at: "desc" },
            select: { code_personnel: true },
          });

          const code = new Code("P", 3, lastPersonnel?.code_personnel ?? "");

          createdPersonnel = await tx.personnel.create({
            data: {
              etablissement_id: etablissementId,
              utilisateur_id: createdUser.id,
              code_personnel: code.next(),
              date_embauche: new Date(),
              statut: "ACTIF",
            },
            select: { id: true, code_personnel: true },
          });
        }

        if (shouldCreateEnseignant) {
          if (!createdPersonnel?.id) {
            throw new Error(
              "Le profil enseignant n'a pas pu etre cree car aucun personnel n'a ete genere.",
            );
          }

          createdEnseignant = await tx.enseignant.create({
            data: {
              personnel_id: createdPersonnel.id,
              departement_principal_id: null,
            },
            select: { id: true },
          });
        }

        return {
          utilisateur: {
            id: createdUser.id,
            email: createdUser.email,
          },
          profil: {
            id: createdProfile.id,
          },
          personnel: createdPersonnel,
          enseignant: createdEnseignant,
          role: {
            id: role.id,
            nom: role.nom,
          },
        };
      });

      Response.success(res, "Compte cree avec succes.", result);
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async approveOwnerRegistration(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub?.trim() ?? null;
      const pendingUserId = req.params.id?.trim();

      if (!actorId) {
        return Response.error(
          res,
          "Authentification requise pour approuver ce proprietaire.",
          401,
          new Error("missing actor"),
        );
      }

      if (!pendingUserId) {
        return Response.error(
          res,
          "Identifiant de demande proprietaire manquant.",
          400,
          new Error("missing pending user id"),
        );
      }

      const isAdmin = await this.userHasSystemAdminRole(actorId);
      if (!isAdmin) {
        return Response.error(
          res,
          "Seul un administrateur systeme peut approuver un proprietaire d'etablissement.",
          403,
          new Error("forbidden"),
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id
          FROM utilisateurs
          WHERE id = ${pendingUserId}
          FOR UPDATE
        `);

        const pendingUser = await tx.utilisateur.findUnique({
          where: { id: pendingUserId },
          select: {
            id: true,
            email: true,
            telephone: true,
            statut: true,
            etablissement_id: true,
            scope_json: true,
          },
        });

        if (!pendingUser) {
          throw new Error("La demande proprietaire est introuvable.");
        }

        const pendingData = this.parsePendingOwnerRegistrationData(pendingUser.scope_json);
        const pendingScope = this.parseOwnerRegistrationScope(pendingUser.scope_json);
        if (!pendingData) {
          throw new Error("Ce compte ne correspond pas a une demande proprietaire approuvable.");
        }

        if (pendingUser.statut === StatutCompte.ACTIF && pendingUser.etablissement_id) {
          throw new Error("Cette demande proprietaire a deja ete approuvee.");
        }

        if (pendingUser.statut !== StatutCompte.INACTIF || pendingUser.etablissement_id) {
          throw new Error("Cette demande proprietaire n'est plus dans un etat approuvable.");
        }

        const input = this.normalizeOwnerProvisioningInput(
          {
            etablissement: pendingData.etablissement,
            utilisateur: {
              email: pendingData.utilisateur?.email ?? pendingUser.email,
              telephone: pendingData.utilisateur?.telephone ?? pendingUser.telephone,
            },
            profil: pendingData.profil,
          },
          false,
        );

        return this.withOwnerEmailLock(tx, input.email, async () => {
          await this.assertOwnerEmailAvailable(input.email, {
            tx,
            ignoreUserId: pendingUser.id,
          });

          return this.provisionOwnerEstablishment(tx, input, {
            existingUserId: pendingUser.id,
            ownerScope: this.buildOwnerRegistrationScope(input, "APPROVED", {
              submittedAt: pendingScope?.submittedAt ?? null,
              decidedAt: new Date().toISOString(),
              decidedByUserId: actorId,
            }),
          });
        });
      });

      Response.success(res, "Demande proprietaire approuvee avec succes.", result);
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async rejectOwnerRegistration(
    req: Request,
    res: R,
  ): Promise<void> {
    try {
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub?.trim() ?? null;
      const pendingUserId = req.params.id?.trim();

      if (!actorId) {
        return Response.error(
          res,
          "Authentification requise pour rejeter ce proprietaire.",
          401,
          new Error("missing actor"),
        );
      }

      if (!pendingUserId) {
        return Response.error(
          res,
          "Identifiant de demande proprietaire manquant.",
          400,
          new Error("missing pending user id"),
        );
      }

      const isAdmin = await this.userHasSystemAdminRole(actorId);
      if (!isAdmin) {
        return Response.error(
          res,
          "Seul un administrateur systeme peut rejeter un proprietaire d'etablissement.",
          403,
          new Error("forbidden"),
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id
          FROM utilisateurs
          WHERE id = ${pendingUserId}
          FOR UPDATE
        `);

        const pendingUser = await tx.utilisateur.findUnique({
          where: { id: pendingUserId },
          select: {
            id: true,
            email: true,
            telephone: true,
            statut: true,
            etablissement_id: true,
            scope_json: true,
          },
        });

        if (!pendingUser) {
          throw new Error("La demande proprietaire est introuvable.");
        }

        const pendingScope = this.parseOwnerRegistrationScope(pendingUser.scope_json);
        if (!pendingScope || pendingScope.status !== "PENDING") {
          throw new Error("Ce compte ne correspond pas a une demande proprietaire rejetable.");
        }

        if (pendingUser.statut !== StatutCompte.INACTIF || pendingUser.etablissement_id) {
          throw new Error("Cette demande proprietaire n'est plus dans un etat rejetable.");
        }

        const input = this.normalizeOwnerProvisioningInput(
          {
            etablissement: pendingScope.data?.etablissement,
            utilisateur: {
              email: pendingScope.data?.utilisateur?.email ?? pendingUser.email,
              telephone: pendingScope.data?.utilisateur?.telephone ?? pendingUser.telephone,
            },
            profil: pendingScope.data?.profil,
          },
          false,
        );

        const updated = await tx.utilisateur.update({
          where: { id: pendingUser.id },
          data: {
            statut: StatutCompte.SUSPENDU,
            scope_json: this.buildOwnerRegistrationScope(input, "REJECTED", {
              submittedAt: pendingScope.submittedAt ?? null,
              decidedAt: new Date().toISOString(),
              decidedByUserId: actorId,
            }),
          },
          select: {
            id: true,
            email: true,
            statut: true,
          },
        });

        return {
          utilisateur: updated,
          etablissement: pendingScope.data?.etablissement ?? null,
        };
      });

      Response.success(res, "Demande proprietaire rejetee avec succes.", result);
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async getPendingOwnerRegistrations(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub?.trim() ?? null;

      if (!actorId) {
        Response.error(
          res,
          "Authentification requise pour consulter les demandes proprietaires.",
          401,
          new Error("missing actor"),
        );
        return;
      }

      const isAdmin = await this.userHasSystemAdminRole(actorId);
      if (!isAdmin) {
        Response.error(
          res,
          "Seul un administrateur systeme peut consulter les demandes proprietaires.",
          403,
          new Error("forbidden"),
        );
        return;
      }

      const rawPage = Number(req.query.page ?? 1);
      const rawTake = Number(req.query.take ?? 25);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
      const take = Number.isFinite(rawTake)
        ? Math.min(Math.max(Math.floor(rawTake), 1), 100)
        : 25;
      const skip = (page - 1) * take;

      const pendingOwnerPredicate = Prisma.sql`
        u.statut = ${StatutCompte.INACTIF}
        AND u.etablissement_id IS NULL
        AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(u.scope_json, '$.option')), '')) LIKE '%validation%'
        AND NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(u.scope_json, '$.data.etablissement.nom')), '')), '') IS NOT NULL
      `;

      const [countRows, rows] = await Promise.all([
        prisma.$queryRaw<Array<{ total: unknown }>>(Prisma.sql`
          SELECT COUNT(*) AS total
          FROM utilisateurs u
          WHERE ${pendingOwnerPredicate}
        `),
        prisma.$queryRaw<Array<{
          id: string;
          email: string | null;
          telephone: string | null;
          statut: StatutCompte;
          scope_json: Prisma.JsonValue | null;
          created_at: Date;
        }>>(Prisma.sql`
          SELECT
            u.id,
            u.email,
            u.telephone,
            u.statut,
            u.scope_json,
            u.created_at
          FROM utilisateurs u
          WHERE ${pendingOwnerPredicate}
          ORDER BY u.created_at DESC
          LIMIT ${take} OFFSET ${skip}
        `),
      ]);

      const total = this.parseMysqlLockResult(countRows[0]?.total);

      Response.success(res, "Demandes proprietaires en attente.", rows, {
        page,
        take,
        total,
        hasNextPage: skip + rows.length < total,
      });
    } catch (error) {
      next(error);
    }
  }

  private async getOwnerRegistrationStatus(
    req: Request,
    res: R,
  ): Promise<void> {
    try {
      const rawEmail =
        typeof req.body?.email === "string" ? req.body.email : "";
      const email = rawEmail.trim().toLowerCase();

      if (!email) {
        return Response.error(
          res,
          "L'email est obligatoire pour verifier une demande proprietaire.",
          400,
          new Error("missing email"),
        );
      }

      if (email.length > 254 || !OWNER_EMAIL_REGEX.test(email)) {
        return Response.error(
          res,
          "L'email fourni est invalide.",
          400,
          new Error("invalid email"),
        );
      }

      const rows = await prisma.utilisateur.findMany({
        where: { email },
        select: {
          id: true,
          email: true,
          statut: true,
          etablissement_id: true,
          scope_json: true,
          updated_at: true,
        },
        orderBy: {
          updated_at: "desc",
        },
      });

      const candidate = rows
        .map((row) => ({
          row,
          ownerRegistration: this.parseOwnerRegistrationScope(row.scope_json),
        }))
        .find((item) => item.ownerRegistration);

      if (!candidate || !candidate.ownerRegistration) {
        return Response.error(
          res,
          "Aucune demande proprietaire n'a ete retrouvee pour cet email.",
          404,
          new Error("owner registration not found"),
        );
      }

      const { row, ownerRegistration } = candidate;
      const statusLabel =
        ownerRegistration.status === "APPROVED"
          ? "APPROUVEE"
          : ownerRegistration.status === "REJECTED"
            ? "REJETEE"
            : "EN_ATTENTE";
      const message =
        ownerRegistration.status === "APPROVED"
          ? "Votre demande proprietaire a ete approuvee. Vous pouvez maintenant vous connecter."
          : ownerRegistration.status === "REJECTED"
            ? "Votre demande proprietaire a ete rejetee. Contactez l'administrateur pour plus d'informations."
            : "Votre demande proprietaire est encore en attente de validation.";

      Response.success(res, "Statut de la demande proprietaire.", {
        id: row.id,
        email: row.email,
        status: ownerRegistration.status,
        statusLabel,
        message,
        canLogin: ownerRegistration.status === "APPROVED" && row.statut === StatutCompte.ACTIF,
        submittedAt: ownerRegistration.submittedAt,
        decidedAt: ownerRegistration.decidedAt,
        etablissement: ownerRegistration.etablissement ?? ownerRegistration.data?.etablissement ?? null,
      });
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async updateUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const existing = await this.getScopedUserById(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(
          res,
          "Utilisateur introuvable dans cet etablissement.",
          404,
          new Error("user not found"),
        );
        return;
      }

      const body: Utilisateur = req.body;
      const id: string = req.params.id;
      const payload = {
        ...Utils.omit(body, "id"),
        etablissement_id: tenant.tenantId,
      };
      const result: any = await this.user.update(id, payload);
      Response.success(res, "Database updated successfully", sanitizeUserResponse(result))
    } catch (error) {
      next(error);
    }
  }

  private async deleteUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const existing = await this.getScopedUserById(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(
          res,
          "Utilisateur introuvable dans cet etablissement.",
          404,
          new Error("user not found"),
        );
        return;
      }

      const result = await this.user.delete(req.params.id);
      Response.success(res, "User deleted successfully", sanitizeUserResponse(result));
    } catch (error) {
      next(error);
    }
  }

  private toDateOrNull(value?: Date | string | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parsePendingOwnerRegistrationData(
    rawScope: unknown,
  ): OwnerProvisioningPayload | null {
    const ownerRegistration = this.parseOwnerRegistrationScope(rawScope);
    if (!ownerRegistration || ownerRegistration.status !== "PENDING") {
      return null;
    }

    return ownerRegistration.data;
  }

  private parseOwnerRegistrationScope(
    rawScope: unknown,
  ): OwnerRegistrationScopeData | null {
    const scopeObject = parseScopeObject(rawScope);
    if (!scopeObject) return null;

    const ownerRegistration =
      scopeObject.owner_registration &&
      typeof scopeObject.owner_registration === "object" &&
      !Array.isArray(scopeObject.owner_registration)
        ? (scopeObject.owner_registration as Record<string, unknown>)
        : null;

    const explicitStatus =
      typeof ownerRegistration?.status === "string"
        ? ownerRegistration.status.trim().toUpperCase()
        : "";

    const option =
      typeof scopeObject.option === "string"
        ? scopeObject.option.trim().toLowerCase()
        : "";

    const status = (
      explicitStatus === "PENDING" ||
      explicitStatus === "APPROVED" ||
      explicitStatus === "REJECTED"
        ? explicitStatus
        : option.includes("rejet")
          ? "REJECTED"
          : option.includes("approuv")
            ? "APPROVED"
            : option.includes("validation")
              ? "PENDING"
              : null
    ) as OwnerRegistrationLifecycleStatus | null;

    if (!status) return null;

    const data = scopeObject.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const record = data as Record<string, unknown>;
    const etablissementDecision =
      ownerRegistration?.etablissement &&
      typeof ownerRegistration.etablissement === "object" &&
      !Array.isArray(ownerRegistration.etablissement)
        ? (ownerRegistration.etablissement as OwnerRegistrationScopeData["etablissement"])
        : null;

    return {
      status,
      submittedAt:
        typeof ownerRegistration?.submitted_at === "string" ? ownerRegistration.submitted_at : null,
      decidedAt:
        typeof ownerRegistration?.decided_at === "string" ? ownerRegistration.decided_at : null,
      decidedByUserId:
        typeof ownerRegistration?.decided_by_user_id === "string"
          ? ownerRegistration.decided_by_user_id
          : null,
      etablissement: etablissementDecision,
      data: {
        etablissement:
          record.etablissement &&
          typeof record.etablissement === "object" &&
          !Array.isArray(record.etablissement)
            ? (record.etablissement as OwnerProvisioningPayload["etablissement"])
            : null,
        utilisateur:
          record.utilisateur &&
          typeof record.utilisateur === "object" &&
          !Array.isArray(record.utilisateur)
            ? (record.utilisateur as OwnerProvisioningPayload["utilisateur"])
            : null,
        profil:
          record.profil && typeof record.profil === "object" && !Array.isArray(record.profil)
            ? (record.profil as OwnerProvisioningPayload["profil"])
            : null,
      },
    };
  }

  private normalizeOwnerProvisioningInput(
    payload: OwnerProvisioningPayload,
    requirePassword: boolean,
  ): NormalizedOwnerProvisioningInput {
    const etablissementNom = payload.etablissement?.nom?.trim() ?? "";
    const email = payload.utilisateur?.email?.trim().toLowerCase() ?? "";
    const telephone = payload.utilisateur?.telephone?.trim() || null;
    const password = payload.utilisateur?.mot_de_passe_hash?.trim() || null;
    const profilPrenom = payload.profil?.prenom?.trim() ?? "";
    const profilNom = payload.profil?.nom?.trim() ?? "";

    if (!etablissementNom) {
      throw new Error("Le nom de l'etablissement est obligatoire.");
    }

    if (!email) {
      throw new Error("L'email du proprietaire est obligatoire.");
    }

    if (email.length > 254 || !OWNER_EMAIL_REGEX.test(email)) {
      throw new Error("L'email du proprietaire est invalide.");
    }

    if (requirePassword && !password) {
      throw new Error("Le mot de passe du proprietaire est obligatoire.");
    }

    if (!profilPrenom || !profilNom) {
      throw new Error("Le prenom et le nom du proprietaire sont obligatoires.");
    }

    return {
      etablissementNom,
      email,
      telephone,
      password,
      profilPrenom,
      profilNom,
      profilDateNaissance: payload.profil?.date_naissance ?? null,
      profilGenre: payload.profil?.genre?.trim() || null,
      profilAdresse: payload.profil?.adresse?.trim() || null,
    };
  }

  private parseMysqlLockResult(value: unknown): number {
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
    return Number.NaN;
  }

  private async withMysqlNamedLock<T>(
    tx: Prisma.TransactionClient,
    lockName: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const lockRows = await tx.$queryRaw<Array<{ acquired: unknown }>>(Prisma.sql`
      SELECT GET_LOCK(${lockName}, 10) AS acquired
    `);
    const lockStatus = this.parseMysqlLockResult(lockRows[0]?.acquired);

    if (lockStatus !== 1) {
      throw new Error("Impossible de reserver cette operation pour le moment. Reessayez.");
    }

    try {
      return await callback();
    } finally {
      try {
        await tx.$queryRaw(Prisma.sql`
          SELECT RELEASE_LOCK(${lockName})
        `);
      } catch {
        // The transaction is about to end anyway; avoid masking the original error.
      }
    }
  }

  private async withOwnerEmailLock<T>(
    tx: Prisma.TransactionClient,
    email: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.withMysqlNamedLock(tx, `owner-email:${email}`, callback);
  }

  private async createEtablissementWithUniqueCode(
    tx: Prisma.TransactionClient,
    nom: string,
  ) {
    return this.withMysqlNamedLock(tx, "etablissement-code-sequence", async () => {
      const lastEtablissement = await tx.etablissement.findFirst({
        orderBy: { created_at: "desc" },
        select: { code: true },
      });
      const code = new Code("ET", 3, lastEtablissement?.code ?? "");

      return tx.etablissement.create({
        data: {
          nom,
          code: code.next(),
          fuseau_horaire: "Indian/Antananarivo",
        },
        select: {
          id: true,
          nom: true,
          code: true,
        },
      });
    });
  }

  private async assertOwnerEmailAvailable(
    email: string,
    options?: {
      tx?: Prisma.TransactionClient | PrismaClient;
      ignoreUserId?: string;
    },
  ) {
    const db = options?.tx ?? prisma;
    const existingUsers = await db.utilisateur.findMany({
      where: {
        email,
        ...(options?.ignoreUserId
          ? {
              id: {
                not: options.ignoreUserId,
              },
            }
          : {}),
      },
      select: {
        id: true,
        statut: true,
        etablissement_id: true,
        scope_json: true,
      },
    });

    if (!existingUsers.length) return;

    const pendingOwnerRequest = existingUsers.find(
      (user) =>
        user.statut === StatutCompte.INACTIF &&
        !user.etablissement_id &&
        this.parsePendingOwnerRegistrationData(user.scope_json),
    );

    if (pendingOwnerRequest) {
      throw new Error("Une demande proprietaire existe deja pour cet email.");
    }

    const rejectedOwnerRequest = existingUsers.find((user) => {
      const ownerRegistration = this.parseOwnerRegistrationScope(user.scope_json);
      return ownerRegistration?.status === "REJECTED";
    });

    if (rejectedOwnerRequest) {
      throw new Error(
        "Une demande proprietaire rejetee existe deja pour cet email. Consultez son statut ou contactez l'administrateur.",
      );
    }

    throw new Error("Un compte utilisateur existe deja avec cet email.");
  }

  private buildPendingOwnerRegistrationScope(
    input: NormalizedOwnerProvisioningInput,
  ): Prisma.InputJsonValue {
    return this.buildOwnerRegistrationScope(input, "PENDING");
  }

  private buildOwnerRegistrationScope(
    input: NormalizedOwnerProvisioningInput,
    status: OwnerRegistrationLifecycleStatus,
    options?: {
      submittedAt?: string | null;
      decidedAt?: string | null;
      decidedByUserId?: string | null;
      etablissement?: {
        id?: string | null;
        nom?: string | null;
        code?: string | null;
      } | null;
    },
  ): Prisma.InputJsonValue {
    const submittedAt = options?.submittedAt ?? new Date().toISOString();
    const decidedAt = options?.decidedAt ?? null;
    const optionLabel =
      status === "APPROVED"
        ? "Demande proprietaire approuvee"
        : status === "REJECTED"
          ? "Demande proprietaire rejetee"
          : "En attente de validation proprietaire";

    return {
      option: optionLabel,
      owner_registration: {
        status,
        submitted_at: submittedAt,
        decided_at: decidedAt,
        decided_by_user_id: options?.decidedByUserId ?? null,
        etablissement: options?.etablissement ?? null,
      },
      data: {
        etablissement: {
          nom: input.etablissementNom,
        },
        utilisateur: {
          email: input.email,
          telephone: input.telephone,
        },
        profil: {
          prenom: input.profilPrenom,
          nom: input.profilNom,
          date_naissance: input.profilDateNaissance,
          genre: input.profilGenre,
          adresse: input.profilAdresse,
        },
      },
    } as Prisma.InputJsonValue;
  }

  private async provisionOwnerEstablishment(
    tx: Prisma.TransactionClient,
    input: NormalizedOwnerProvisioningInput,
    options?: { existingUserId?: string; ownerScope?: Prisma.InputJsonValue },
  ) {
    const createdEtablissement = await this.createEtablissementWithUniqueCode(
      tx,
      input.etablissementNom,
    );

    const persistedUser = options?.existingUserId
      ? await tx.utilisateur.update({
          where: { id: options.existingUserId },
          data: {
            statut: StatutCompte.ACTIF,
            scope_json: options?.ownerScope ?? Prisma.JsonNull,
            etablissement_id: createdEtablissement.id,
            email: input.email,
            telephone: input.telephone,
          },
          select: {
            id: true,
            email: true,
            etablissement_id: true,
            statut: true,
          },
        })
      : await tx.utilisateur.create({
          data: {
            etablissement_id: createdEtablissement.id,
            email: input.email,
            telephone: input.telephone,
            mot_de_passe_hash: await bcrypt.hash(input.password as string, 10),
            statut: StatutCompte.ACTIF,
          },
          select: {
            id: true,
            email: true,
            etablissement_id: true,
            statut: true,
          },
        });

    const profile = await tx.profil.upsert({
      where: { utilisateur_id: persistedUser.id },
      update: {
        prenom: input.profilPrenom,
        nom: input.profilNom,
        date_naissance: this.toDateOrNull(input.profilDateNaissance),
        genre: input.profilGenre,
        adresse: input.profilAdresse,
      },
      create: {
        utilisateur_id: persistedUser.id,
        prenom: input.profilPrenom,
        nom: input.profilNom,
        date_naissance: this.toDateOrNull(input.profilDateNaissance),
        genre: input.profilGenre,
        adresse: input.profilAdresse,
      },
      select: {
        id: true,
        prenom: true,
        nom: true,
      },
    });

    const directionRole = await tx.role.create({
      data: {
        etablissement_id: createdEtablissement.id,
        nom: "DIRECTION",
        scope_json: {
          role_template: "DIRECTION",
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        nom: true,
      },
    });

    await tx.utilisateurRole.create({
      data: {
        utilisateur_id: persistedUser.id,
        role_id: directionRole.id,
      },
    });

    return {
      etablissement: createdEtablissement,
      utilisateur: persistedUser,
      profil: profile,
      role: directionRole,
    };
  }

  private async userHasSystemAdminRole(userId: string) {
    const user = await prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        roles: {
          include: {
            role: {
              select: {
                nom: true,
                scope_json: true,
              },
            },
          },
        },
      },
    });

    if (!user) return false;

    const roleNames = extractRoleNamesFromUser(user);
    return hasSystemAdminRoleNames(roleNames);
  }

  private getCreationErrorMessage(error: unknown): string {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta?.target.join(", ")
        : String(error.meta?.target ?? "");

      if (target.includes("email")) {
        return "Un utilisateur avec cet email existe deja dans cet etablissement.";
      }

      if (target.includes("utilisateur_id")) {
        return "Le profil ou le rattachement utilisateur existe deja.";
      }

      return "Une donnee unique existe deja. Verifiez les informations du compte.";
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return "Le role ou une relation obligatoire du compte est invalide.";
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Une erreur est survenue lors de la creation du compte.";
  }
}

export default UserApp;
