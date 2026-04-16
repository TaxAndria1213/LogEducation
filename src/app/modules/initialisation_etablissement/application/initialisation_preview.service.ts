import { prisma } from "../../../service/prisma";
import InitialisationEtablissementModel from "../models/initialisation_etablissement.model";
import {
  buildInitialSetupPreviewBlocks,
  normalizeInitialSetupPayload,
} from "./builders/initial_setup.builder";
import {
  buildNewSchoolYearPreviewBlocks,
  normalizeNewSchoolYearPayload,
} from "./builders/new_school_year.builder";

class InitialisationPreviewService {
  private model: InitialisationEtablissementModel;

  constructor() {
    this.model = new InitialisationEtablissementModel();
  }

  public async previewInitialSetup(body: unknown) {
    const payload = normalizeInitialSetupPayload(body);
    const status = await this.model.getStatus(payload.etablissement_id);
    const blocks = buildInitialSetupPreviewBlocks(payload);
    const warnings: string[] = [];

    if (status.counts.sites > 0 && payload.include_site_principal) {
      warnings.push(
        "Un ou plusieurs sites existent deja. Le commit evitera les doublons evidents.",
      );
    }

    if (status.counts.annees > 0 && payload.create_initial_year) {
      warnings.push(
        "Une annee scolaire existe deja. Verifie que tu veux bien creer une nouvelle annee de depart.",
      );
    }

    if (!payload.selected_level_codes.length && !payload.custom_levels.length) {
      warnings.push(
        "Aucun niveau n'est selectionne. L'etablissement restera peu exploitable sans niveaux.",
      );
    }

    if (payload.classes_mode !== "PLUS_TARD") {
      const levelsWithoutClasses = payload.classes_by_level
        .filter((group) => group.class_names.length === 0)
        .map((group) => group.level_nom);

      if (levelsWithoutClasses.length > 0) {
        warnings.push(
          `Chaque niveau selectionne doit avoir au moins une classe. Niveaux incomplets : ${levelsWithoutClasses.join(", ")}.`,
        );
      }

      if (!payload.create_initial_year && !status.active_year) {
        warnings.push(
          "Aucune annee scolaire active n'est disponible pour rattacher les classes. Cree une annee initiale ou active une annee existante.",
        );
      }
    }

    if (payload.academic_mode !== "PLUS_TARD") {
      const levelsWithoutAcademic = payload.academic_by_level
        .filter(
          (group) => !group.programme_nom.trim() || group.subjects.length === 0,
        )
        .map((group) => group.level_nom);

      if (levelsWithoutAcademic.length > 0) {
        warnings.push(
          `Chaque niveau selectionne doit avoir un programme et au moins une matiere. Niveaux incomplets : ${levelsWithoutAcademic.join(", ")}.`,
        );
      }

      if (!payload.create_initial_year && !status.active_year) {
        warnings.push(
          "Aucune annee scolaire active n'est disponible pour rattacher les programmes. Cree une annee initiale ou active une annee existante.",
        );
      }
    }

    return {
      type: "NOUVEL_ETABLISSEMENT",
      payload,
      blocks,
      estimated_creates: blocks.reduce(
        (sum, block) => sum + block.estimation_creation,
        0,
      ),
      ready_blocks: blocks.filter((block) => block.statut === "PRET").length,
      deferred_blocks: blocks.filter((block) => block.statut === "DIFFERE").length,
      warnings,
      current_status: status,
    };
  }

  public async previewNewSchoolYear(body: unknown) {
    const payload = normalizeNewSchoolYearPayload(body);
    const status = await this.model.getStatus(payload.etablissement_id);

    const sourceYear = payload.source_annee_id
      ? await prisma.anneeScolaire.findUnique({
          where: { id: payload.source_annee_id },
          select: { id: true, nom: true },
        })
      : await prisma.anneeScolaire.findFirst({
          where: {
            etablissement_id: payload.etablissement_id,
            est_active: true,
          },
          orderBy: { created_at: "desc" },
          select: { id: true, nom: true },
        });

    const sourcePeriodCount =
      payload.copy_periodes && sourceYear
        ? await prisma.periode.count({
            where: { annee_scolaire_id: sourceYear.id },
          })
        : 0;

    const blocks = buildNewSchoolYearPreviewBlocks(payload, sourcePeriodCount);
    const warnings: string[] = [];

    if (payload.copy_periodes && !sourceYear) {
      warnings.push(
        "Aucune annee source n'a ete trouvee pour reprendre les periodes.",
      );
    }

    if (!status.ready_for_new_school_year) {
      warnings.push(
        "Cet etablissement n'a pas encore d'annee scolaire en reference. La creation reste possible, mais sans reprise.",
      );
    }

    return {
      type: "NOUVELLE_ANNEE_SCOLAIRE",
      payload,
      blocks,
      estimated_creates: blocks.reduce(
        (sum, block) => sum + block.estimation_creation,
        0,
      ),
      ready_blocks: blocks.filter((block) => block.statut === "PRET").length,
      deferred_blocks: blocks.filter((block) => block.statut === "DIFFERE").length,
      warnings,
      current_status: status,
      source_year: sourceYear,
    };
  }
}

export default InitialisationPreviewService;
