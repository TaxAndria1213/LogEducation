import { Prisma } from "@prisma/client";
import { prisma } from "../../../service/prisma";
import {
  normalizeBulletinConfig,
  normalizeEvaluationTypes,
  normalizePedagogieNoteRules,
  normalizePedagogieInitialisationConfig,
  PEDAGOGIE_INITIALISATION_SCOPE,
  type PedagogieBulletinConfig,
  type PedagogieEvaluationTypeConfig,
  type PedagogieNoteRules,
} from "../../pedagogie_shared/utils/reportCardTemplate";

type TeacherAssignments = Record<string, Record<string, string>>;

export type SavePedagogieConfigPayload = {
  etablissement_id: string;
  annee_scolaire_id?: string | null;
  mode_initialisation: "RAPIDE" | "AVANCE";
  default_teacher_id?: string | null;
  teacher_assignments?: unknown;
  evaluation_types?: unknown[];
  note_rules?: Record<string, unknown> | PedagogieNoteRules;
  bulletin_config?: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class InitialisationPedagogiqueService {
  private readonly defaultReportCardTemplateName = "Modele bulletin par defaut";

  private extractYearId(regleJson: unknown): string | null {
    if (!isPlainObject(regleJson)) return null;
    return typeof regleJson.annee_scolaire_id === "string" &&
      regleJson.annee_scolaire_id.trim()
      ? regleJson.annee_scolaire_id.trim()
      : null;
  }

  private normalizeConfigRecord<T extends { regle_json: unknown } | null>(record: T): T {
    if (!record || !isPlainObject(record.regle_json)) {
      return record;
    }

    const normalizedConfig = normalizePedagogieInitialisationConfig(
      record.regle_json,
    );

    return {
      ...record,
      regle_json: {
        ...(record.regle_json as Record<string, unknown>),
        evaluation_types: normalizedConfig.evaluation_types,
        note_rules: normalizedConfig.note_rules,
        bulletin_config: normalizedConfig.bulletin_config,
      },
    };
  }

  private normalizeTeacherAssignments(raw: unknown): TeacherAssignments {
    if (!isPlainObject(raw)) return {};

    const normalized: TeacherAssignments = {};

    Object.entries(raw).forEach(([levelId, subjects]) => {
      if (!isPlainObject(subjects)) return;

      const levelAssignments: Record<string, string> = {};

      Object.entries(subjects).forEach(([subjectCode, teacherId]) => {
        if (typeof teacherId !== "string" || !teacherId.trim()) return;
        levelAssignments[subjectCode] = teacherId.trim();
      });

      if (Object.keys(levelAssignments).length > 0) {
        normalized[levelId] = levelAssignments;
      }
    });

    return normalized;
  }

  private async resolveYear(
    etablissementId: string,
    requestedYearId?: string | null,
  ) {
    if (typeof requestedYearId === "string" && requestedYearId.trim()) {
      const year = await prisma.anneeScolaire.findFirst({
        where: {
          id: requestedYearId.trim(),
          etablissement_id: etablissementId,
        },
        select: {
          id: true,
          nom: true,
          est_active: true,
        },
      });

      if (!year) {
        throw new Error(
          "L'annee scolaire selectionnee n'appartient pas a l'etablissement actif.",
        );
      }

      return year;
    }

    return prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: etablissementId,
        est_active: true,
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        nom: true,
        est_active: true,
      },
    });
  }

  private async syncEvaluationTypes(
    etablissementId: string,
    evaluationTypes: PedagogieEvaluationTypeConfig[],
  ) {
    await Promise.all(
      evaluationTypes.map(async (type) => {
        const existing = await prisma.typeEvaluationRef.findFirst({
          where: {
            etablissement_id: etablissementId,
            code: type.code,
          },
          select: { id: true },
        });

        const data = {
          etablissement_id: etablissementId,
          code: type.code,
          nom: type.label,
          poids_defaut: type.poids,
          default_max_score: type.note_max,
          include_in_average: type.include_in_average,
          show_in_report_card: type.show_in_report_card,
          is_final_exam: type.is_final_exam,
          is_active: true,
        };

        if (existing) {
          await prisma.typeEvaluationRef.update({
            where: { id: existing.id },
            data,
          });
          return;
        }

        await prisma.typeEvaluationRef.create({
          data,
        });
      }),
    );
  }

  private async syncDefaultReportCardTemplate(
    etablissementId: string,
    yearId: string,
    bulletinConfig: PedagogieBulletinConfig,
  ) {
    await prisma.reportCardTemplate.updateMany({
      where: {
        etablissement_id: etablissementId,
        annee_scolaire_id: yearId,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });

    const existing = await prisma.reportCardTemplate.findFirst({
      where: {
        etablissement_id: etablissementId,
        annee_scolaire_id: yearId,
        nom: this.defaultReportCardTemplateName,
      },
      select: {
        id: true,
      },
    });

    const data = {
      etablissement_id: etablissementId,
      annee_scolaire_id: yearId,
      niveau_scolaire_id: null,
      nom: this.defaultReportCardTemplateName,
      description: bulletinConfig.description ?? null,
      template_type: bulletinConfig.template_type,
      show_assessment_details: bulletinConfig.show_assessment_details,
      show_assessment_type_summary:
        bulletinConfig.show_assessment_type_summary,
      show_only_final_exam: bulletinConfig.show_only_final_exam,
      show_subject_average: bulletinConfig.show_subject_average,
      show_subject_coefficient: bulletinConfig.show_subject_coefficient,
      show_subject_points: bulletinConfig.show_subject_points,
      show_subject_rank: bulletinConfig.show_subject_rank,
      show_teacher_appreciation: bulletinConfig.show_teacher_appreciation,
      show_general_average: bulletinConfig.show_general_average,
      show_total_coefficients: bulletinConfig.show_total_coefficients,
      show_total_points: bulletinConfig.show_total_points,
      show_general_rank: bulletinConfig.show_general_rank,
      show_mention: bulletinConfig.show_mention,
      show_decision: bulletinConfig.show_decision,
      show_general_appreciation: bulletinConfig.show_general_appreciation,
      show_absences: bulletinConfig.show_absences,
      show_late_count: bulletinConfig.show_late_count,
      show_logo: bulletinConfig.show_logo,
      show_signature: bulletinConfig.show_signature,
      is_default: true,
      is_active: true,
    };

    if (existing) {
      await prisma.reportCardTemplate.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await prisma.reportCardTemplate.create({
      data,
    });
  }

  public async getConfig(
    etablissementId: string,
    requestedYearId?: string | null,
  ) {
    const year = await this.resolveYear(etablissementId, requestedYearId);

    if (!year) {
      return {
        active_year_id: null,
        config: null,
      };
    }

    const records = await prisma.regleNote.findMany({
      where: {
        etablissement_id: etablissementId,
        scope: PEDAGOGIE_INITIALISATION_SCOPE,
      },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
    });

    const config = this.normalizeConfigRecord(
      records.find((record) => this.extractYearId(record.regle_json) === year.id) ??
        null,
    );

    return {
      active_year_id: year.id,
      config,
    };
  }

  public async saveConfig(payload: SavePedagogieConfigPayload) {
    const year = await this.resolveYear(
      payload.etablissement_id,
      payload.annee_scolaire_id,
    );

    if (!year) {
      throw new Error(
        "Aucune annee scolaire active n'est definie pour cet etablissement.",
      );
    }

    const existingRecords = await prisma.regleNote.findMany({
      where: {
        etablissement_id: payload.etablissement_id,
        scope: PEDAGOGIE_INITIALISATION_SCOPE,
      },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
    });

    const existingRecord =
      existingRecords.find(
        (record) => this.extractYearId(record.regle_json) === year.id,
      ) ?? null;

    const normalizedEvaluationTypes = normalizeEvaluationTypes(
      payload.evaluation_types,
    );
    const normalizedBulletinConfig = normalizeBulletinConfig(
      payload.bulletin_config,
    );
    const normalizedNoteRules = normalizePedagogieNoteRules(payload.note_rules);

    const regleJson = {
      annee_scolaire_id: year.id,
      mode_initialisation: payload.mode_initialisation,
      default_teacher_id:
        typeof payload.default_teacher_id === "string" &&
        payload.default_teacher_id.trim()
          ? payload.default_teacher_id.trim()
          : null,
      teacher_assignments: this.normalizeTeacherAssignments(
        payload.teacher_assignments,
      ),
      evaluation_types: normalizedEvaluationTypes,
      note_rules: normalizedNoteRules,
      bulletin_config: normalizedBulletinConfig,
      updated_at: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    const config = existingRecord
      ? await prisma.regleNote.update({
          where: { id: existingRecord.id },
          data: {
            etablissement_id: payload.etablissement_id,
            scope: PEDAGOGIE_INITIALISATION_SCOPE,
            regle_json: regleJson,
          },
        })
      : await prisma.regleNote.create({
          data: {
            etablissement_id: payload.etablissement_id,
            scope: PEDAGOGIE_INITIALISATION_SCOPE,
            regle_json: regleJson,
          },
        });

    await this.syncEvaluationTypes(
      payload.etablissement_id,
      normalizedEvaluationTypes,
    );
    await this.syncDefaultReportCardTemplate(
      payload.etablissement_id,
      year.id,
      normalizedBulletinConfig,
    );

    return {
      active_year_id: year.id,
      config: this.normalizeConfigRecord(config),
    };
  }
}

export default InitialisationPedagogiqueService;
