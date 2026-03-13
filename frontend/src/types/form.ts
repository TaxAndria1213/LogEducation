import type { StatutInscription } from "./models";

export type InscriptionScolarite = {
          code_eleve: string;
          classe_id: string;
          date_entree: string;
          date_inscription: string;
          statut_inscription: StatutInscription;
        }