import { create } from "zustand";
import type { Etablissement } from "../../../types/models";
import EtablissementService from "../../../services/etablissement.service";

const etablisementService = new EtablissementService();
type EtablissementChoiceStoreType = {
    etablissementId: string | null;
    etablissementList: Etablissement[];
    setEtablissementId: (etablissementId: string | null) => void;
    getEtablissementList: () => void;
};

export const useEtablissementChoiceStore = create<EtablissementChoiceStoreType>()((set) => ({
    etablissementId: null,
    etablissementList: [],
    setEtablissementId: (etablissementId: string | null) => {
        localStorage.setItem("contextParams", JSON.stringify({ etablissement_id: etablissementId }));
        set({ etablissementId });
    },
    getEtablissementList: () => {
        const fetchEtablissementList = async () => {
            try {
                const response = await etablisementService.getAll({
                    includeAll: true,
                });
                set({ etablissementList: response?.data?.data || [] });
            } catch (error) {
                console.error("Erreur lors de la récupération de la liste des établissements", error);
            }
        };
        fetchEtablissementList();
    },
}));