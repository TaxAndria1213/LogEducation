import { prisma } from "../../../service/prisma";
import type { Prisma } from "@prisma/client";
import {
  buildInitialSetupPreviewBlocks,
  getInitialYearWindow,
  isImmediateCreationMode,
  normalizeInitialSetupPayload,
  resolveLevelNames,
  validateInitialSetupFinanceCatalogues,
  validateInitialSetupPeriods,
} from "./builders/initial_setup.builder";
import { defaultRoleTemplates } from "./templates/default-roles.template";
import {
  buildNewSchoolYearPreviewBlocks,
  normalizeNewSchoolYearPayload,
} from "./builders/new_school_year.builder";

type InitialisationDbClient = Prisma.TransactionClient;

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

function buildClassRecordKey(levelCode: string, className: string) {
  return `${levelCode.trim()}::${className.trim().toLowerCase()}`;
}

class InitialisationCommitService {
  private async assertNoOverlap(
    db: InitialisationDbClient,
    etablissementId: string,
    dateDebut: Date,
    dateFin: Date,
  ) {
    const conflict = await db.anneeScolaire.findFirst({
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
    db: InitialisationDbClient,
    sourceYearId: string,
    targetYearId: string,
    targetStart: Date,
    targetEnd: Date,
  ) {
    const sourceYear = await db.anneeScolaire.findUnique({
      where: { id: sourceYearId },
      select: { id: true, date_debut: true },
    });

    if (!sourceYear) {
      throw new Error("Annee source introuvable pour recopier les periodes.");
    }

    const sourcePeriods = await db.periode.findMany({
      where: { annee_scolaire_id: sourceYearId },
      orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
    });

    if (!sourcePeriods.length) return 0;

    const sourceStart = toDayStart(sourceYear.date_debut);
    if (!sourceStart) {
      throw new Error(
        "Impossible de recalculer les periodes de l'annee source.",
      );
    }

    let created = 0;

    for (const periode of sourcePeriods) {
      const periodeStart = toDayStart(periode.date_debut);
      const periodeEnd = toDayEnd(periode.date_fin);
      if (!periodeStart || !periodeEnd) continue;

      const startOffset = Math.round(
        (periodeStart.getTime() - sourceStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const endOffset = Math.round(
        (periodeEnd.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      const nextStart = new Date(targetStart.getTime());
      nextStart.setDate(nextStart.getDate() + startOffset);

      const nextEnd = new Date(targetStart.getTime());
      nextEnd.setDate(nextEnd.getDate() + endOffset);
      nextEnd.setHours(23, 59, 59, 999);

      if (
        nextStart.getTime() > targetEnd.getTime() ||
        nextEnd.getTime() > targetEnd.getTime()
      ) {
        continue;
      }

      await db.periode.create({
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

  private async createPeriodsForYear(
    db: InitialisationDbClient,
    targetYearId: string,
    periods: {
      nom: string;
      date_debut?: string;
      date_fin?: string;
      ordre: number;
    }[],
  ) {
    let created = 0;

    for (const periode of [...periods].sort(
      (left, right) => left.ordre - right.ordre,
    )) {
      const dateDebut = toDayStart(periode.date_debut);
      const dateFin = toDayEnd(periode.date_fin);

      if (!periode.nom || !dateDebut || !dateFin) {
        continue;
      }

      await db.periode.create({
        data: {
          annee_scolaire_id: targetYearId,
          nom: periode.nom,
          date_debut: dateDebut,
          date_fin: dateFin,
          ordre: periode.ordre,
        },
      });
      created += 1;
    }

    return created;
  }

  public async commitInitialSetup(body: unknown) {
    const payload = normalizeInitialSetupPayload(body);
    return prisma.$transaction(async (db) => {
      const etablissement = await db.etablissement.findUnique({
        where: { id: payload.etablissement_id },
        select: { id: true, nom: true },
      });

      if (!etablissement) {
        throw new Error(
          "Etablissement introuvable pour lancer l'initialisation.",
        );
      }

      const blocks = buildInitialSetupPreviewBlocks(payload);
      const created = {
        sites: 0,
        annees: 0,
        periodes: 0,
        niveaux: 0,
        classes: 0,
        departements: 0,
        matieres: 0,
        programmes: 0,
        lignes_programme: 0,
        catalogue_frais: 0,
        roles: 0,
      };
      const skipped: string[] = [];
      const warnings: string[] = [];
      const shouldCreateClasses = isImmediateCreationMode(payload.classes_mode);
      const shouldCreateAcademic = isImmediateCreationMode(
        payload.academic_mode,
      );
      const shouldCreateSecurity = isImmediateCreationMode(
        payload.security_mode,
      );
      const shouldCreateFinance = isImmediateCreationMode(payload.finance_mode);
      let targetYear: { id: string; nom: string } | null = null;

      if (payload.include_site_principal) {
        const siteName = payload.site_principal_nom || "Site principal";
        const existingSite = await db.site.findFirst({
          where: {
            etablissement_id: payload.etablissement_id,
            nom: siteName,
          },
          select: { id: true },
        });

        if (existingSite) {
          skipped.push(`Le site ${siteName} existe deja.`);
        } else {
          await db.site.create({
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
        const yearWindow = getInitialYearWindow(payload);
        const periodIssues = validateInitialSetupPeriods(payload);

        if (!yearWindow || !payload.annee_nom) {
          throw new Error(
            "Complete le libelle, la date de debut et la date de fin de l'annee initiale avant la generation.",
          );
        }

        if (yearWindow.date_debut.getTime() > yearWindow.date_fin.getTime()) {
          throw new Error(
            "La date de debut de l'annee initiale doit preceder la date de fin.",
          );
        }

        if (periodIssues.length > 0) {
          throw new Error(periodIssues[0]);
        }

        const dateDebut = new Date(yearWindow.date_debut.getTime());
        const dateFin = new Date(yearWindow.date_fin.getTime());
        dateFin.setHours(23, 59, 59, 999);

        await this.assertNoOverlap(
          db,
          payload.etablissement_id,
          dateDebut,
          dateFin,
        );
        await db.anneeScolaire.updateMany({
          where: {
            etablissement_id: payload.etablissement_id,
            est_active: true,
          },
          data: { est_active: false },
        });
        targetYear = await db.anneeScolaire.create({
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
        created.periodes += await this.createPeriodsForYear(
          db,
          targetYear.id,
          payload.periods,
        );
      }

      if (!targetYear) {
        targetYear = await db.anneeScolaire.findFirst({
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
      const classRecords = new Map<string, { id: string; nom: string }>();
      for (const level of levels) {
        const exists = await db.niveauScolaire.findFirst({
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

        const createdLevel = await db.niveauScolaire.create({
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
            const exists = await db.classe.findFirst({
              where: {
                etablissement_id: payload.etablissement_id,
                annee_scolaire_id: targetYear.id,
                niveau_scolaire_id: levelRecord.id,
                nom: className,
              },
              select: { id: true, nom: true },
            });
            const classKey = buildClassRecordKey(group.level_code, className);

            if (exists) {
              skipped.push(
                `La classe ${className} existe deja pour le niveau ${group.level_nom} dans l'annee ${targetYear.nom}.`,
              );
              classRecords.set(classKey, exists);
              continue;
            }

            const createdClass = await db.classe.create({
              data: {
                etablissement_id: payload.etablissement_id,
                annee_scolaire_id: targetYear.id,
                niveau_scolaire_id: levelRecord.id,
                site_id: null,
                nom: className,
                enseignant_principal_id: null,
              },
              select: { id: true, nom: true },
            });
            classRecords.set(classKey, createdClass);
            created.classes += 1;
          }
        }
      }

      if (shouldCreateAcademic) {
        const levelsWithoutAcademic = payload.academic_by_level
          .filter(
            (group) =>
              !group.programme_nom.trim() || group.subjects.length === 0,
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

        const pedagogieDepartment = await db.departement.findFirst({
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

          let programme = await db.programme.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: targetYear.id,
              niveau_scolaire_id: levelRecord.id,
              nom: group.programme_nom,
            },
            select: { id: true, nom: true },
          });

          if (!programme) {
            programme = await db.programme.create({
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
            let matiere = await db.matiere.findFirst({
              where: {
                etablissement_id: payload.etablissement_id,
                nom: subject.nom,
              },
              select: { id: true, nom: true },
            });

            if (!matiere) {
              matiere = await db.matiere.create({
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

            const existingLine = await db.programmeMatiere.findFirst({
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

            await db.programmeMatiere.create({
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

      if (shouldCreateSecurity) {
        if (payload.selected_role_names.length === 0) {
          throw new Error(
            "Selectionne au moins un role standard pour generer le bloc Securite.",
          );
        }

        for (const roleName of payload.selected_role_names) {
          const normalizedInput = roleName.trim();
          const template = defaultRoleTemplates.find(
            (entry) =>
              entry.nom === normalizedInput ||
              entry.suggestedName === normalizedInput ||
              entry.key === normalizedInput,
          );
          const normalizedRoleName =
            template?.suggestedName.trim() ?? normalizedInput;

          if (!template || !normalizedRoleName) {
            warnings.push(`Le role standard ${roleName} n'est pas reconnu.`);
            continue;
          }

          const exists = await db.role.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              OR: [{ nom: normalizedRoleName }, { nom: template.key }],
            },
            select: { id: true },
          });

          if (exists) {
            skipped.push(`Le role ${normalizedRoleName} existe deja.`);
            continue;
          }

          await db.role.create({
            data: {
              etablissement_id: payload.etablissement_id,
              nom: normalizedRoleName,
              scope_json: {
                role_template: template.key,
                role_template_label: template.label,
                permissions: template.permissions,
              },
            },
          });
          created.roles += 1;
        }
      }

      if (shouldCreateFinance) {
        const financeIssues = validateInitialSetupFinanceCatalogues(payload);

        if (financeIssues.length > 0) {
          throw new Error(financeIssues[0]);
        }

        for (const catalogue of payload.finance_catalogues) {
          const levelRecord = catalogue.level_code
            ? levelRecords.get(catalogue.level_code)
            : null;

          if (catalogue.level_code && !levelRecord) {
            warnings.push(
              `Le niveau cible du frais ${catalogue.nom} est introuvable au moment de creer le catalogue.`,
            );
            continue;
          }

          let classRecord: { id: string; nom: string } | null = null;
          if (catalogue.class_name) {
            if (!levelRecord) {
              warnings.push(
                `La classe cible du frais ${catalogue.nom} ne peut pas etre resolue sans niveau.`,
              );
              continue;
            }

            if (!targetYear) {
              throw new Error(
                `La classe ${catalogue.class_name} ne peut pas etre ciblee sans annee scolaire active.`,
              );
            }

            const classLevelCode = catalogue.level_code ?? "";
            const classKey = buildClassRecordKey(
              classLevelCode,
              catalogue.class_name,
            );
            classRecord = classRecords.get(classKey) ?? null;

            if (!classRecord) {
              classRecord = await db.classe.findFirst({
                where: {
                  etablissement_id: payload.etablissement_id,
                  annee_scolaire_id: targetYear.id,
                  niveau_scolaire_id: levelRecord.id,
                  nom: catalogue.class_name,
                },
                select: { id: true, nom: true },
              });
              if (classRecord) {
                classRecords.set(classKey, classRecord);
              }
            }

            if (!classRecord) {
              throw new Error(
                `La classe ${catalogue.class_name} doit etre creee avant de generer le frais ${catalogue.nom}.`,
              );
            }
          }

          const niveauScolaireId = levelRecord?.id ?? null;
          const exists = await db.catalogueFrais.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              niveau_scolaire_id: niveauScolaireId,
              nom: catalogue.nom,
            },
            select: { id: true },
          });

          if (exists) {
            skipped.push(
              niveauScolaireId
                ? `Le frais ${catalogue.nom} existe deja pour le niveau ${levelRecord?.nom}.`
                : `Le frais global ${catalogue.nom} existe deja.`,
            );
            continue;
          }

          const eligibilityJson: Record<string, unknown> = {
            ...(catalogue.eligibilite_json ?? {}),
          };
          if (classRecord) {
            const existingClasseIds = Array.isArray(eligibilityJson.classe_ids)
              ? eligibilityJson.classe_ids.filter(
                  (entry): entry is string => typeof entry === "string",
                )
              : [];
            eligibilityJson.classe_ids = Array.from(
              new Set([...existingClasseIds, classRecord.id]),
            );
          }
          const eligibilityInput =
            Object.keys(eligibilityJson).length > 0
              ? (eligibilityJson as Prisma.InputJsonObject)
              : undefined;

          await db.catalogueFrais.create({
            data: {
              etablissement_id: payload.etablissement_id,
              niveau_scolaire_id: niveauScolaireId,
              usage_scope: catalogue.usage_scope,
              nom: catalogue.nom,
              description: catalogue.description ?? null,
              montant: catalogue.montant ?? 0,
              devise: catalogue.devise,
              nombre_tranches: catalogue.nombre_tranches,
              est_recurrent: catalogue.est_recurrent,
              periodicite: catalogue.est_recurrent
                ? catalogue.periodicite
                : null,
              prorata_eligible: catalogue.prorata_eligible,
              eligibilite_json: eligibilityInput,
              statut_validation: "APPROUVEE",
              approuve_par_utilisateur_id: null,
              approuve_le: new Date(),
              motif_rejet: null,
            },
          });
          created.catalogue_frais += 1;
        }
      }

      return {
        type: "NOUVEL_ETABLISSEMENT",
        etablissement,
        created,
        skipped,
        warnings,
        deferred_blocks: blocks
          .filter((block) => block.statut === "DIFFERE")
          .map((block) => block.libelle),
      };
    });
  }

  public async commitNewSchoolYear(body: unknown) {
    const payload = normalizeNewSchoolYearPayload(body);
    const dateDebut = toDayStart(payload.date_debut);
    const dateFin = toDayEnd(payload.date_fin);

    if (!dateDebut || !dateFin) {
      throw new Error(
        "Les dates de debut et de fin de la nouvelle annee sont invalides.",
      );
    }

    if (dateDebut.getTime() > dateFin.getTime()) {
      throw new Error(
        "La date de debut de la nouvelle annee doit preceder la date de fin.",
      );
    }

    return prisma.$transaction(async (db) => {
      await this.assertNoOverlap(
        db,
        payload.etablissement_id,
        dateDebut,
        dateFin,
      );

      const activeYear = await db.anneeScolaire.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          est_active: true,
        },
        orderBy: { created_at: "desc" },
        select: { id: true, nom: true },
      });

      const sourceYearId = payload.source_annee_id ?? activeYear?.id;
      const sourcePeriodCount =
        payload.copy_periodes && sourceYearId
          ? await db.periode.count({
              where: { annee_scolaire_id: sourceYearId },
            })
          : 0;
      const blocks = buildNewSchoolYearPreviewBlocks(
        payload,
        sourcePeriodCount,
      );

      if (payload.close_current_year && activeYear) {
        await db.anneeScolaire.update({
          where: { id: activeYear.id },
          data: { est_active: false },
        });
      }

      await db.anneeScolaire.updateMany({
        where: {
          etablissement_id: payload.etablissement_id,
          est_active: true,
        },
        data: { est_active: false },
      });

      const newYear = await db.anneeScolaire.create({
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
          ? await this.copyPeriodesFromSource(
              db,
              sourceYearId,
              newYear.id,
              dateDebut,
              dateFin,
            )
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
          .filter((block) => block.statut === "DIFFERE")
          .map((block) => block.libelle),
      };
    });
  }
}

export default InitialisationCommitService;
