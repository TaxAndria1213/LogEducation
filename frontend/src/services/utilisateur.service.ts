import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type { Profil, Utilisateur } from "../generated/zod";
import type { WizardDataUserPersonnel } from "../types/types";

export type CreateAccountFromLinkPayload = {
  etablissement_id: string;
  role_id: string;
  utilisateur: Pick<Utilisateur, "email" | "telephone" | "mot_de_passe_hash">;
  profil: Pick<
    Profil,
    "prenom" | "nom" | "date_naissance" | "genre" | "adresse"
  >;
};

export type AdminOwnerCreationPayload = {
  etablissement: {
    nom: string;
  };
  utilisateur: Pick<Utilisateur, "email" | "telephone" | "mot_de_passe_hash">;
  profil: Pick<
    Profil,
    "prenom" | "nom" | "date_naissance" | "genre" | "adresse"
  >;
};

class UtilisateurService extends Service {
  constructor() {
    super("user");
  }

  async createOwnerRegistrationRequest(
    data: AdminOwnerCreationPayload,
  ) {
    try {
      const response = await Http.post(
        ["api", this.url, "create-owner-registration"].join("/"),
        data,
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createOwnerByAdmin(data: AdminOwnerCreationPayload) {
    try {
      const response = await Http.post(
        ["api", this.url, "create-owner-by-admin"].join("/"),
        data,
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createUser(data: Partial<Utilisateur>) {
    try {
      const response = await Http.post(["api", this.url, "create"].join("/"), data);
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createAccountFromLink(data: CreateAccountFromLinkPayload) {
    try {
      const response = await Http.post(
        ["api", this.url, "create-from-link"].join("/"),
        data,
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async approveOwnerRegistration(userId: string) {
    try {
      const response = await Http.post(
        ["api", this.url, userId, "approve-owner-registration"].join("/"),
        {},
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createPersonnelAccount(data: WizardDataUserPersonnel) {
    try {
      console.log(data);
      const utilisateur = {
        ...data.utilisateur,
        statut: "ACTIF",
        etablissement_id: data.etablissement_id,
      } as Utilisateur;
      const utilisateurResponse = await Http.post(
        ["api", this.url, "create"].join("/"),
        utilisateur,
      );
      console.log(
        "UtilisateurService.createPersonnelAccount.utilisateurResponse",
        utilisateurResponse,
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export default UtilisateurService;
