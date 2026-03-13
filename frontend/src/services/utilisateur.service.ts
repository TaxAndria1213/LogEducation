import { Http } from "../app/api/Http";
import Service from "../app/api/Service"
import type { Profil, Role, Utilisateur, UtilisateurRole } from "../generated/zod";
import type { AproveUserDataType, WizardDataUserPersonnel } from "../types/types";
import EtablissementService from "./etablissement.service";
import ProfileService from "./profile.service";
import RoleService from "./role.service";
import UtilisateurRoleService from "./utilisateur_role.service";

class UtilisateurService extends Service {
    constructor() {
        super("user");
    }

    async createDirectionAccount(data: Pick<Utilisateur, "email" | "mot_de_passe_hash" | "telephone" | "statut" | "scope_json">) {
        try {
            const response = await Http.post(["api", this.url, "create"].join("/"), data);
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

    async createPersonnelAccount(data: WizardDataUserPersonnel) {
        try {
            console.log(data);
            const utilisateur = {
                ...data.utilisateur,
                statut: "ACTIF",
                etablissement_id: data.etablissement_id,
            } as Utilisateur;
            //enregistrement de l'utilisateur
            const utilisateurResponse = await Http.post(["api", this.url, "create"].join("/"), utilisateur);
            console.log("🚀 ~ UtilisateurService ~ createPersonnelAccount ~ utilisateurResponse:", utilisateurResponse)

        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    //Approuver l'inscription d'un établissement avec sont utilisateur de la direction par defaut
    async aproveUser(data: AproveUserDataType) {
        try {
            //Enregistrement de l'établissement
            const etablissementService = new EtablissementService();
            const etablissementResponse = await etablissementService.create(data.etablissement);

            if (etablissementResponse?.status.success) {
                //Récupérer l'utilisateur
                const utilisateurResponse = await this.get(data.utilisateur.email as string);
                const idUtilisateur = utilisateurResponse?.data.id

                if (utilisateurResponse?.status.success) {
                    //Mise à jour de l'utilisateur
                    const dataUser: Partial<Utilisateur> = {
                        statut: "ACTIF",
                        scope_json: null,
                        etablissement_id: etablissementResponse.data.id
                    }

                    await this.update(utilisateurResponse.data.id, dataUser);

                    //création du profil
                    const profileService = new ProfileService();
                    const dataProfile: Profil = {
                        utilisateur_id: idUtilisateur,
                        id: "",
                        photo_url: "",
                        contact_urgence_json: {},
                        created_at: new Date(),
                        updated_at: new Date(),
                        ...data.profil,
                    }
                    await profileService.create(dataProfile);

                    //création de role
                    const dataRole: Partial<Role> = {
                        nom: "DIRECTION",
                        etablissement_id: etablissementResponse.data.id,
                    }

                    const roleService = new RoleService();
                    const roleResponse = await roleService.create(dataRole);

                    //affecter un role à l'utilisateur créé
                    console.log("🚀 ~ UtilisateurService ~ aproveUser ~ roleResponse:", idUtilisateur)
                    const dataUtilisateurRole: Partial<UtilisateurRole> = {
                        role_id: roleResponse?.data.id,
                        utilisateur_id: idUtilisateur,
                    }
                    const utilisateurRoleService = new UtilisateurRoleService();
                    await utilisateurRoleService.create(dataUtilisateurRole);

                    console.log("🚀 ~ UtilisateurService ~ aproveUser ~ roleResponse:", roleResponse)
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}

export default UtilisateurService;