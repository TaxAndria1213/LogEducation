import type { StatutInscription } from "./models";

export type InscriptionScolarite = {
          code_eleve: string;
          niveau_scolaire_id?: string;
          classe_id?: string;
          date_entree: string;
          date_inscription: string;
          statut_inscription: StatutInscription;
          type_inscription?: string;
        }
