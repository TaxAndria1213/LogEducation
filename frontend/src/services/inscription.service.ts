/* eslint-disable @typescript-eslint/no-explicit-any */
import { Http } from "../app/api/Http";
import { api } from "../app/api/axios";
import Service from "../app/api/Service";
import type { Inscription } from "../types/models";

class InscriptionService extends Service {
    constructor() {
        super("inscription");
    }

    async createFull(payload: any) {
        return await Http.post(["/api", this.url, "full"].join("/"), payload);
    }

    async updateFull(id: string, payload: any) {
        return await Http.put(["/api", this.url, id, "full"].join("/"), payload);
    }

    async getDocumentTypes(params?: {
        etablissement_id?: string | null;
        type_inscription?: string | null;
    }) {
        return await Http.get(["/api", this.url, "document-types"].join("/"), params ?? {});
    }

    async getResume(id: string) {
        return await Http.get(["/api", this.url, id, "resume"].join("/"), {});
    }

    async getEditPayload(id: string) {
        return await Http.get(["/api", this.url, id, "edit"].join("/"), {});
    }

    async updateDocument(
        inscriptionId: string,
        documentId: string,
        payload: {
            statut?: string;
            fourni?: boolean;
            commentaire_admin?: string | null;
            fichier_id?: string | null;
            date_depot?: string | Date | null;
            date_verification?: string | Date | null;
        },
    ) {
        return await Http.put(["/api", this.url, inscriptionId, "documents", documentId].join("/"), payload);
    }

    async uploadDocument(
        inscriptionId: string,
        documentId: string,
        payload: {
            file_name: string;
            mime_type?: string | null;
            content_base64: string;
            commentaire_admin?: string | null;
        },
    ) {
        return await Http.post(["/api", this.url, inscriptionId, "documents", documentId, "upload"].join("/"), payload);
    }

    async validateEnrollment(id: string) {
        return await Http.post(["/api", this.url, id, "validate"].join("/"), {});
    }

    async cancelEnrollment(
        id: string,
        payload?: {
            reason?: string | null;
            date_sortie?: string | Date | null;
        },
    ) {
        return await Http.post(["/api", this.url, id, "cancel"].join("/"), payload ?? {});
    }

    async updateMedicalProfile(
        inscriptionId: string,
        payload: {
            groupe_sanguin?: string | null;
            allergies?: string | null;
            maladies_particulieres?: string | null;
            traitement_medical?: string | null;
            medecin_traitant?: string | null;
            telephone_medecin?: string | null;
            autorisation_prise_en_charge_medicale?: boolean;
            personne_a_contacter_urgence?: string | null;
            telephone_urgence?: string | null;
        },
    ) {
        return await Http.put(["/api", this.url, inscriptionId, "medical"].join("/"), payload);
    }

    async updateSchoolHistory(
        inscriptionId: string,
        payload: {
            ancien_etablissement?: string | null;
            ancienne_classe?: string | null;
            annee_precedente?: string | null;
            derniere_moyenne?: number | null;
            decision_precedente?: string | null;
            mention_precedente?: string | null;
            motif_transfert?: string | null;
            observations?: string | null;
            reprise_auto?: boolean;
        },
    ) {
        return await Http.put(["/api", this.url, inscriptionId, "school-history"].join("/"), payload);
    }

    async fetchDocumentFile(inscriptionId: string, documentId: string, options?: { download?: boolean }) {
        const response = await api.get(["/api", this.url, inscriptionId, "documents", documentId, "file"].join("/"), {
            params: options?.download ? { download: "1" } : undefined,
            responseType: "blob",
        });

        return {
            blob: response.data as Blob,
            mimeType: response.headers["content-type"] as string | undefined,
            fileName: this.extractFileNameFromDisposition(response.headers["content-disposition"] as string | undefined),
        };
    }

    async fetchLinkedFile(inscriptionId: string, linkId: string, options?: { download?: boolean }) {
        const response = await api.get(["/api", this.url, inscriptionId, "files", linkId].join("/"), {
            params: options?.download ? { download: "1" } : undefined,
            responseType: "blob",
        });

        return {
            blob: response.data as Blob,
            mimeType: response.headers["content-type"] as string | undefined,
            fileName: this.extractFileNameFromDisposition(response.headers["content-disposition"] as string | undefined),
        };
    }

    private extractFileNameFromDisposition(disposition?: string) {
        if (!disposition) {
            return null;
        }

        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1]);
        }

        const simpleMatch = disposition.match(/filename="?([^"]+)"?/i);
        if (!simpleMatch?.[1]) {
            return null;
        }

        return decodeURIComponent(simpleMatch[1]);
    }

    async getStudentRegisteredNumberThisYear(annee_scolaire_id: string) {
        try {
            const result = await this.getAll({
                where: JSON.stringify({ annee_scolaire_id: annee_scolaire_id } as Partial<Inscription>),
            })

            if (result?.status.success) {
                return result.data.meta.total;
            }
        } catch (error) {
            console.log(error);
        }
    }

    async changeClass(
        id: string,
        payload: {
            classe_id: string;
            date_effet?: string | Date | null;
            catalogue_frais_scolarite_id?: string | null;
            generer_regularisation_financiere?: boolean;
            motif?: string | null;
        },
    ) {
        return Http.post(["/api", this.url, id, "change-class"].join("/"), payload);
    }
}

export default InscriptionService
