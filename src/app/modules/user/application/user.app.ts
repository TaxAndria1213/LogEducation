/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import UserModel from "../models/user.model";
import bcrypt from "bcrypt";
import Utils from "../../../utils";
import Response from "../../../common/app/response";
import { Prisma, PrismaClient, StatutCompte, Utilisateur } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import Code from "../../../common/app/code";

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

const prisma = new PrismaClient();

class UserApp {
  public app: Application;
  public router: Router;
  private user: UserModel;

  constructor(app: Application) {
    this.app = app;
    this.user = new UserModel();
    this.router = Router();
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
    this.router.put("/:id", this.updateUser.bind(this));
    this.router.delete("/:id", this.deleteUser.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:email", this.getUserByEmail.bind(this));
    return this.router;
  }

  private async getUserByEmail(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await this.user.findByEmail(req.params.email as string);
      Response.success(res, "Data user.", result)
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

      const result = await prisma.utilisateur.create({
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

      const isAdmin = await this.userHasSystemRole(actorId, "ADMIN");
      if (!isAdmin) {
        return Response.error(
          res,
          "Seul un administrateur peut creer un etablissement avec son proprietaire.",
          403,
          new Error("forbidden"),
        );
      }

      const input = this.normalizeOwnerProvisioningInput(
        req.body as OwnerProvisioningPayload,
        true,
      );

      const result = await prisma.$transaction((tx) =>
        this.provisionOwnerEstablishment(tx, input),
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
      console.log(req.query)
      const result = await getAllPaginated(req.query, this.user);
      Response.success(res, "Data user.", result)
    } catch (error) {
      next(error);
    }
  }

  private async createUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Utilisateur = req.body;
      console.log("🚀 ~ UserApp ~ createUser ~ body:", body)
      const userData: Utilisateur = {
        ...body,
        mot_de_passe_hash: await bcrypt.hash(body.mot_de_passe_hash as string, 10),
      }
      const result: object = await this.user.create(userData);
      Response.success(res, "user created successfully", result)
    } catch (error) {
      console.log("🚀 ~ UserApp ~ createUser ~ error:", error)
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

      const isAdmin = await this.userHasSystemRole(actorId, "ADMIN");
      if (!isAdmin) {
        return Response.error(
          res,
          "Seul un administrateur peut approuver un proprietaire d'etablissement.",
          403,
          new Error("forbidden"),
        );
      }

      const pendingUser = await prisma.utilisateur.findUnique({
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
        return Response.error(
          res,
          "La demande proprietaire est introuvable.",
          404,
          new Error("pending user not found"),
        );
      }

      const pendingData = this.parsePendingOwnerRegistrationData(pendingUser.scope_json);
      if (!pendingData) {
        return Response.error(
          res,
          "Ce compte ne correspond pas a une demande proprietaire approuvable.",
          400,
          new Error("invalid pending owner registration"),
        );
      }

      if (pendingUser.statut === StatutCompte.ACTIF && pendingUser.etablissement_id) {
        return Response.error(
          res,
          "Cette demande proprietaire a deja ete approuvee.",
          400,
          new Error("already approved"),
        );
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

      const result = await prisma.$transaction((tx) =>
        this.provisionOwnerEstablishment(tx, input, { existingUserId: pendingUser.id }),
      );

      Response.success(res, "Demande proprietaire approuvee avec succes.", result);
    } catch (error) {
      const message = this.getCreationErrorMessage(error);
      Response.error(res, message, 400, error as Error);
      return;
    }
  }

  private async updateUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Utilisateur = req.body;
      const id: string = req.params.id;
      const result: any = await this.user.update(id, Utils.omit(body, "id"));
      Response.success(res, "Database updated successfully", result)
    } catch (error) {
      next(error);
    }
  }

  private async deleteUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await this.user.delete(req.params.id);
      Response.success(res, "User deleted successfully", result);
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
    const scopeObject = parseScopeObject(rawScope);
    if (!scopeObject) return null;

    const option =
      typeof scopeObject.option === "string"
        ? scopeObject.option.trim().toLowerCase()
        : "";

    if (option && !option.includes("validation")) {
      return null;
    }

    const data = scopeObject.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const record = data as Record<string, unknown>;

    return {
      etablissement:
        record.etablissement && typeof record.etablissement === "object" && !Array.isArray(record.etablissement)
          ? (record.etablissement as OwnerProvisioningPayload["etablissement"])
          : null,
      utilisateur:
        record.utilisateur && typeof record.utilisateur === "object" && !Array.isArray(record.utilisateur)
          ? (record.utilisateur as OwnerProvisioningPayload["utilisateur"])
          : null,
      profil:
        record.profil && typeof record.profil === "object" && !Array.isArray(record.profil)
          ? (record.profil as OwnerProvisioningPayload["profil"])
          : null,
    };
  }

  private normalizeOwnerProvisioningInput(
    payload: OwnerProvisioningPayload,
    requirePassword: boolean,
  ): NormalizedOwnerProvisioningInput {
    const etablissementNom = payload.etablissement?.nom?.trim() ?? "";
    const email = payload.utilisateur?.email?.trim() ?? "";
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

  private buildPendingOwnerRegistrationScope(
    input: NormalizedOwnerProvisioningInput,
  ): Prisma.InputJsonValue {
    return {
      option: "En attente de validation proprietaire",
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
    options?: { existingUserId?: string },
  ) {
    const lastEtablissement = await tx.etablissement.findFirst({
      orderBy: { created_at: "desc" },
      select: { code: true },
    });
    const code = new Code("ET", 3, lastEtablissement?.code ?? "");

    const createdEtablissement = await tx.etablissement.create({
      data: {
        nom: input.etablissementNom,
        code: code.next(),
        fuseau_horaire: "Indian/Antananarivo",
      },
      select: {
        id: true,
        nom: true,
        code: true,
      },
    });

    const persistedUser = options?.existingUserId
      ? await tx.utilisateur.update({
          where: { id: options.existingUserId },
          data: {
            statut: StatutCompte.ACTIF,
            scope_json: Prisma.JsonNull,
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

  private async userHasSystemRole(userId: string, expectedRole: string) {
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

    return user.roles.some((assignment) => {
      const resolved = resolveSystemRoleName(
        assignment.role?.nom ?? null,
        assignment.role?.scope_json ?? null,
      );
      return resolved === expectedRole;
    });
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
