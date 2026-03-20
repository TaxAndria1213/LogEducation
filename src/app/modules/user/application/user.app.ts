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
    this.router.post("/create-from-link", this.createAccountFromLink.bind(this));
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
          select: { id: true, nom: true, etablissement_id: true },
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

        const normalizedRoleName = role.nom.trim().toUpperCase();
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
