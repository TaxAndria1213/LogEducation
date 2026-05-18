/* eslint-disable @typescript-eslint/no-explicit-any */
import { Http } from "../app/api/Http";
import Service from "../app/api/Service";

export type EnrollmentDraftType =
  | "NEW_ENROLLMENT"
  | "RE_ENROLLMENT"
  | "TRANSFER"
  | "PRE_ENROLLMENT";

export type EnrollmentDraftStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "EXPIRED"
  | "DELETED";

export type EnrollmentDraftPayload = {
  etablissement_id?: string | null;
  annee_scolaire_id?: string | null;
  eleve_id?: string | null;
  draft_type?: EnrollmentDraftType;
  current_step?: number;
  student_data?: Record<string, unknown> | null;
  schooling_data?: Record<string, unknown> | null;
  guardians_data?: Record<string, unknown> | null;
  finance_data?: Record<string, unknown> | null;
  documents_data?: Record<string, unknown> | null;
  medical_data?: Record<string, unknown> | null;
  previous_school_data?: Record<string, unknown> | null;
  access_data?: Record<string, unknown> | null;
  consents_data?: Record<string, unknown> | null;
  observations_data?: Record<string, unknown> | null;
  services_data?: Record<string, unknown> | null;
  payment_schedule_data?: Record<string, unknown> | null;
};

class EnrollmentDraftService extends Service {
  constructor() {
    super("enrollment-drafts");
  }

  async create(payload: EnrollmentDraftPayload) {
    return Http.post(["/api", this.url].join("/"), payload);
  }

  async createFromStudent(studentId: string, payload?: EnrollmentDraftPayload) {
    return Http.post(["/api", this.url, "from-student", studentId].join("/"), payload ?? {});
  }

  async getOne(id: string) {
    return Http.get(["/api", this.url, id].join("/"), {});
  }

  async updateDraft(id: string, payload: EnrollmentDraftPayload) {
    return Http.put(["/api", this.url, id].join("/"), payload);
  }

  async autosave(id: string, payload: EnrollmentDraftPayload) {
    return Http.patch(["/api", this.url, id, "autosave"].join("/"), payload);
  }

  async deleteDraft(id: string) {
    return Http.delete(["/api", this.url, id].join("/"));
  }

  async restore(id: string) {
    return Http.post(["/api", this.url, id, "restore"].join("/"), {});
  }

  async prepareSubmit(id: string) {
    return Http.post(["/api", this.url, id, "submit"].join("/"), {});
  }

  async markSubmitted(id: string, inscriptionId: string) {
    return Http.post(["/api", this.url, id, "mark-submitted"].join("/"), {
      submitted_inscription_id: inscriptionId,
    });
  }

  async getSummary(id: string) {
    return Http.get(["/api", this.url, id, "summary"].join("/"), {});
  }

  async createFile(id: string, payload: Record<string, unknown>) {
    return Http.post(["/api", this.url, id, "files"].join("/"), payload);
  }

  async getFiles(id: string) {
    return Http.get(["/api", this.url, id, "files"].join("/"), {});
  }

  async deleteFile(id: string, fileId: string) {
    return Http.delete(["/api", this.url, id, "files", fileId].join("/"));
  }
}

export default EnrollmentDraftService;
