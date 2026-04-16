import { prisma } from "../../../service/prisma";
import {
  buildInitialSetupPreviewBlocks,
  normalizeInitialSetupPayload,
  resolveLevelNames,
} from "./builders/initial_setup.builder";
import {
  buildNewSchoolYearPreviewBlocks,
  normalizeNewSchoolYearPayload,
} from "./builders/new_school_year.builder";

const defaultDepartements = [
  "Direction",
  "Administration",
  "Scolarite",
  "Finance",
  "Pedagogie",
  "Vie scolaire",
  "Cantine",
  "Transport",
  "Bibliotheque",
];

function parseDateValue(value?: string | Date | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const trimmed = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayStart(value?: string | Date | null): Date | null {
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDayEnd(value?: string | Date | null): Date | null {
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

class InitialisationCommitService {
  private async assertNoOverlap(
    etablissementId: string,
    dateDebut: Date,
    dateFin: Date,
  ) {
    const conflict = await prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: etablissementId,
        date_debut: { lte: dateFin },
        date_fin: { gte: dateDebut },
      },
      select: { id: true, nom: true },
    });

    if (conflict) {
      throw new Error(
        `La periode choisie chevauche deja l'annee scolaire ${conflict.nom}.`,
      );
    }
  }

  private async copyPeriodesFromSource(
    sourceYearId: string,
    targetYearId: string,
    targetStart: Date,
    targetEnd: Date,
  ) {
    const sourceYear = await prisma.anneeScolaire.findUnique({
      where: { id: sourceYearId },
      select: { id: true, date_debut: true },
    });

    if (!sourceYear) {
      throw new Error("Annee source introuvable pour recopier les periodes.");
    }

    const sourcePeriods = await prisma.periode.findMany({
      where: { annee_scolaire_id: sourceYearId },
      orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
    });

    if (!sourcePeriods.length) return 0;

    const sourceStart = toDayStart(sourceYear.date_debut);
    if (!sourceStart) {
      throw new Error("Impossible de recalculer les periodes de l'annee source.");
    }

    let created = 0;

    for (const periode of sourcePeriods) {
      const periodeStart = toDayStart(periode.date_debut);
      const periodeEnd = toDayEnd(periode.date_fin);
      if (!periodeStart || !periodeEnd) continue;

      const startOffset = Math.round(
        (periodeStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const endOffset = Math.round(
        (periodeEnd.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      const nextStart = new Date(targetStart.getTime());
      nextStart.setDate(nextStart.getDate() + startOffset);

      const nextEnd = new Date(targetStart.getTime());
      nextEnd.setDate(nextEnd.getDate() + endOffset);
      nextEnd.setHours(23, 59, 59, 999);

      if (nextStart.getTime() > targetEnd.getTime() || nextEnd.getTime() > targetEnd.getTime()) {
        continue;
      }

      await prisma.periode.create({
        data: {
          annee_scolaire_id: targetYearId,
          nom: periode.nom,
          date_debut: nextStart,
          date_fin: nextEnd,
          ordre: periode.ordre,
        },
      });
      created += 1;
    }

    return created;
  }

  public async commitInitialSetup(body: unknown) {
    const payload = normalizeInitialSetupPayload(body);
    const etablissement = await prisma.etablissement.findUnique({
      where: { id: payload.etablissement_id },
      select: { id: true, nom: true },
    });

    if (!etablissement) {
      throw new Error("Etablissement introuvable pour lancer l'initialisation.");
    }

    const blocks = buildInitialSetupPreviewBlocks(payload);
    const created = {
      sites: 0,
      annees: 0,
      niveaux: 0,
      classes: 0,
      departements: 0,
      matieres: 0,
      programmes: 0,
      lignes_programme: 0,
    };
    const skipped: string[] = [];
    const warnings: string[] = [];
    const shouldCreateClasses = payload.classes_mode !== "PLUS_TARD";
    const shouldCreateAcademic = payload.academic_mode !== "PLUS_TARD";
    let targetYear: { id: string; nom: string } | null = null;

    if (payload.include_site_principal) {
      const siteName = payload.site_principal_nom || "Site principal";
      const existingSite = await prisma.site.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          nom: siteName,
        },
        select: { id: true },
      });

      if (existingSite) {
        skipped.push(`Le site ${siteName} existe deja.`);
      } else {
        await prisma.site.create({
          data: {
            etablissement_id: payload.etablissement_id,
            nom: siteName,
            adresse: payload.site_principal_adresse ?? null,
            telephone: payload.site_principal_telephone ?? null,
          },
        });
        created.sites += 1;
      }
    }

    if (payload.create_initial_year) {
      const dateDebut = toDayStart(payload.annee_date_debut);
      const dateFin = toDayEnd(payload.annee_date_fin);

      if (!payload.annee_nom || !dateDebut || !dateFin) {
        warnings.push(
          "L'annee initiale a ete ignoree car les dates ou le libelle sont incomplets.",
        );
      } else {
        await this.assertNoOverlap(payload.etablissement_id, dateDebut, dateFin);
        await prisma.anneeScolaire.updateMany({
          where: {
            etablissement_id: payload.etablissement_id,
            est_active: true,
          },
          data: { est_active: false },
        });
        targetYear = await prisma.anneeScolaire.create({
          data: {
            etablissement_id: payload.etablissement_id,
            nom: payload.annee_nom,
            date_debut: dateDebut,
            date_fin: dateFin,
            est_active: true,
          },
          select: { id: true, nom: true },
        });
        created.annees += 1;
      }
    }

    if (!targetYear) {
      targetYear = await prisma.anneeScolaire.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          est_active: true,
        },
        orderBy: { created_at: "desc" },
        select: { id: true, nom: true },
      });
    }

    const levels = resolveLevelNames(payload);
    const levelRecords = new Map<string, { id: string; nom: string }>();
    for (const level of levels) {
      const exists = await prisma.niveauScolaire.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          nom: level.nom,
        },
        select: { id: true, nom: true },
      });

      if (exists) {
        skipped.push(`Le niveau ${level.nom} existe deja.`);
        levelRecords.set(level.code, exists);
        continue;
      }

      const createdLevel = await prisma.niveauScolaire.create({
        data: {
          etablissement_id: payload.etablissement_id,
          nom: level.nom,
          ordre: level.ordre,
        },
        select: { id: true, nom: true },
      });
      levelRecords.set(level.code, createdLevel);
      created.niveaux += 1;
    }

    if (shouldCreateClasses) {
      const levelsWithoutClasses = payload.classes_by_level
        .filter((group) => group.class_names.length === 0)
        .map((group) => group.level_nom);

      if (levelsWithoutClasses.length > 0) {
        throw new Error(
          `Chaque niveau selectionne doit avoir au moins une classe. Niveaux incomplets : ${levelsWithoutClasses.join(", ")}.`,
        );
      }

      if (!targetYear) {
        throw new Error(
          "Impossible de creer les classes sans annee scolaire active. Cree d'abord une annee initiale ou active une annee existante.",
        );
      }

      for (const group of payload.classes_by_level) {
        const levelRecord = levelRecords.get(group.level_code);
        if (!levelRecord) {
          warnings.push(
            `Le niveau ${group.level_nom} est introuvable au moment de creer les classes.`,
          );
          continue;
        }

        for (const className of group.class_names) {
          const exists = await prisma.classe.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: targetYear.id,
              niveau_scolaire_id: levelRecord.id,
              nom: className,
            },
            select: { id: true },
          });

          if (exists) {
            skipped.push(
              `La classe ${className} existe deja pour le niveau ${group.level_nom} dans l'annee ${targetYear.nom}.`,
            );
            continue;
          }

          await prisma.classe.create({
            data: {
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: targetYear.id,
              niveau_scolaire_id: levelRecord.id,
              site_id: null,
              nom: className,
              enseignant_principal_id: null,
            },
          });
          created.classes += 1;
        }
      }
    }

    if (payload.create_default_departements) {
      for (const departementNom of defaultDepartements) {
        const exists = await prisma.departement.findFirst({
          where: {
            etablissement_id: payload.etablissement_id,
            nom: departementNom,
          },
          select: { id: true },
        });

        if (exists) {
          continue;
        }

        await prisma.departement.create({
          data: {
            etablissement_id: payload.etablissement_id,
            nom: departementNom,
          },
        });
        created.departements += 1;
      }
    }

    if (shouldCreateAcademic) {
      const levelsWithoutAcademic = payload.academic_by_level
        .filter(
          (group) => !group.programme_nom.trim() || group.subjects.length === 0,
        )
        .map((group) => group.level_nom);

      if (levelsWithoutAcademic.length > 0) {
        throw new Error(
          `Chaque niveau selectionne doit avoir un programme et au moins une matiere. Niveaux incomplets : ${levelsWithoutAcademic.join(", ")}.`,
        );
      }

      if (!targetYear) {
        throw new Error(
          "Impossible de creer les programmes sans annee scolaire active. Cree d'abord une annee initiale ou active une annee existante.",
        );
      }

      const pedagogieDepartment = await prisma.departement.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          nom: "Pedagogie",
        },
        select: { id: true },
      });

      for (const group of payload.academic_by_level) {
        const levelRecord = levelRecords.get(group.level_code);
        if (!levelRecord) {
          warnings.push(
            `Le niveau ${group.level_nom} est introuvable au moment de creer le referentiel academique.`,
          );
          continue;
        }

        let programme = await prisma.programme.findFirst({
          where: {
            etablissement_id: payload.etablissement_id,
            annee_scolaire_id: targetYear.id,
            niveau_scolaire_id: levelRecord.id,
            nom: group.programme_nom,
          },
          select: { id: true, nom: true },
        });

        if (!programme) {
          programme = await prisma.programme.create({
            data: {
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: targetYear.id,
              niveau_scolaire_id: levelRecord.id,
              nom: group.programme_nom,
            },
            select: { id: true, nom: true },
          });
          created.programmes += 1;
        } else {
          skipped.push(
            `Le programme ${group.programme_nom} existe deja pour le niveau ${group.level_nom} dans l'annee ${targetYear.nom}.`,
          );
        }

        for (const subject of group.subjects) {
          let matiere = await prisma.matiere.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              nom: subject.nom,
            },
            select: { id: true, nom: true },
          });

          if (!matiere) {
            matiere = await prisma.matiere.create({
              data: {
                etablissement_id: payload.etablissement_id,
                nom: subject.nom,
                code: subject.code ?? null,
                departement_id: pedagogieDepartment?.id ?? null,
              },
              select: { id: true, nom: true },
            });
            created.matieres += 1;
          }

          const existingLine = await prisma.programmeMatiere.findFirst({
            where: {
              programme_id: programme.id,
              matiere_id: matiere.id,
            },
            select: { id: true },
          });

          if (existingLine) {
            skipped.push(
              `La matiere ${subject.nom} est deja liee au programme ${programme.nom}.`,
            );
            continue;
          }

          await prisma.programmeMatiere.create({
            data: {
              programme_id: programme.id,
              matiere_id: matiere.id,
              heures_semaine:
                typeof subject.heures_semaine === "number"
                  ? Math.round(subject.heures_semaine)
                  : null,
              coefficient:
                typeof subject.coefficient === "number"
                  ? subject.coefficient
                  : null,
            },
          });
          created.lignes_programme += 1;
        }
      }
    }

    return {
      type: "NOUVEL_ETABLISSEMENT",
      etablissement,
      created,
      skipped,
      warnings,
      deferred_blocks: blocks
        .filter((block) => !block.execution_disponible || block.mode === "PLUS_TARD")
        .map((block) => block.libelle),
    };
  }

  public async commitNewSchoolYear(body: unknown) {
    const payload = normalizeNewSchoolYearPayload(body);
    const dateDebut = toDayStart(payload.date_debut);
    const dateFin = toDayEnd(payload.date_fin);

    if (!dateDebut || !dateFin) {
      throw new Error("Les dates de debut et de fin de la nouvelle annee sont invalides.");
    }

    if (dateDebut.getTime() > dateFin.getTime()) {
      throw new Error(
        "La date de debut de la nouvelle annee doit preceder la date de fin.",
      );
    }

    await this.assertNoOverlap(payload.etablissement_id, dateDebut, dateFin);

    const activeYear = await prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: payload.etablissement_id,
        est_active: true,
      },
      orderBy: { created_at: "desc" },
      select: { id: true, nom: true },
    });

    const sourceYearId = payload.source_annee_id ?? activeYear?.id;
    const sourcePeriodCount = payload.copy_periodes && sourceYearId
      ? await prisma.periode.count({
          where: { annee_scolaire_id: sourceYearId },
        })
      : 0;
    const blocks = buildNewSchoolYearPreviewBlocks(payload, sourcePeriodCount);

    if (payload.close_current_year && activeYear) {
      await prisma.anneeScolaire.update({
        where: { id: activeYear.id },
        data: { est_active: false },
      });
    }

    await prisma.anneeScolaire.updateMany({
      where: {
        etablissement_id: payload.etablissement_id,
        est_active: true,
      },
      data: { est_active: false },
    });

    const newYear = await prisma.anneeScolaire.create({
      data: {
        etablissement_id: payload.etablissement_id,
        nom: payload.nom,
        date_debut: dateDebut,
        date_fin: dateFin,
        est_active: true,
      },
    });

    const copiedPeriodes =
      payload.copy_periodes && sourceYearId
        ? await this.copyPeriodesFromSource(sourceYearId, newYear.id, dateDebut, dateFin)
        : 0;

    return {
      type: "NOUVELLE_ANNEE_SCOLAIRE",
      annee: newYear,
      created: {
        annees: 1,
        periodes: copiedPeriodes,
      },
      skipped: [],
      warnings: [],
      deferred_blocks: blocks
        .filter((block) => !block.execution_disponible || block.mode === "PLUS_TARD")
        .map((block) => block.libelle),
    };
  }
}

export default InitialisationCommitService;
