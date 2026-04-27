import {
  normalizeInitialSetupPayload,
  validateInitialSetupFinanceCatalogues,
  type InitialSetupPayload,
} from "../app/modules/initialisation_etablissement/application/builders/initial_setup.builder";

function buildBasePayload(
  overrides: Partial<InitialSetupPayload> = {},
): InitialSetupPayload {
  return {
    etablissement_id: "etab-1",
    include_site_principal: true,
    create_initial_year: true,
    annee_nom: "2026-2027",
    annee_date_debut: "2026-10-01",
    annee_date_fin: "2027-07-31",
    periods_strategy: "STANDARD",
    periods_template_code: "TRIMESTRES",
    periods: [
      { nom: "Trimestre 1", date_debut: "2026-10-01", date_fin: "2026-12-31", ordre: 1 },
      { nom: "Trimestre 2", date_debut: "2027-01-01", date_fin: "2027-03-31", ordre: 2 },
      { nom: "Trimestre 3", date_debut: "2027-04-01", date_fin: "2027-07-31", ordre: 3 },
    ],
    selected_level_codes: ["CP"],
    custom_levels: [],
    classes_by_level: [
      {
        level_code: "CP",
        level_nom: "CP",
        class_names: ["CP A"],
      },
    ],
    academic_by_level: [
      {
        level_code: "CP",
        level_nom: "CP",
        programme_nom: "Programme CP",
        subjects: [{ nom: "Francais", code: "FR", heures_semaine: 5, coefficient: 1 }],
      },
    ],
    finance_catalogues: [],
    selected_role_names: ["ADMIN"],
    classes_mode: "CREATION",
    academic_mode: "CREATION",
    security_mode: "CREATION",
    finance_mode: "CREATION",
    services_mode: "PLUS_TARD",
    audit_mode: "PLUS_TARD",
    ...overrides,
  };
}

describe("Initial setup finance annualization", () => {
  test("normalise automatiquement la scolarite en annuel avec les plans par defaut", () => {
    const payload = normalizeInitialSetupPayload({
      etablissement_id: "etab-1",
      annee_nom: "2026-2027",
      annee_date_debut: "2026-10-01",
      annee_date_fin: "2027-07-31",
      selected_level_codes: ["CP"],
      classes_by_level: [{ level_code: "CP", class_names: ["CP A"] }],
      academic_by_level: [
        {
          level_code: "CP",
          programme_nom: "Programme CP",
          subjects: [{ nom: "Francais" }],
        },
      ],
      finance_mode: "CREATION",
      finance_catalogues: [
        {
          nom: "Scolarite CP",
          montant: 1200000,
          devise: "mga",
          usage_scope: "SCOLARITE",
          nombre_tranches: 10,
          est_recurrent: true,
          periodicite: "monthly",
          prorata_eligible: true,
        },
      ],
    });

    expect(payload.finance_catalogues).toHaveLength(1);
    expect(payload.finance_catalogues[0]).toMatchObject({
      usage_scope: "SCOLARITE",
      mode_facturation: "ANNUEL",
      est_recurrent: false,
      periodicite: null,
      prorata_eligible: false,
      plan_paiement_defaut_code: "10X",
    });
    expect(payload.finance_catalogues[0].plans_paiement_autorises_json).toEqual([
      { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
      { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 4, 8] },
      {
        code: "10X",
        label: "10 tranches",
        nombre_tranches: 10,
        offsets_mois: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    ]);
  });

  test("signale une scolarite recurrente ou sans plans annuels valides", () => {
    const payload = buildBasePayload({
      finance_catalogues: [
        {
          nom: "Scolarite CP",
          description: "Frais annuel",
          montant: 1200000,
          devise: "MGA",
          nombre_tranches: 10,
          usage_scope: "SCOLARITE",
          mode_facturation: "RECURRENT",
          est_recurrent: true,
          periodicite: "monthly",
          prorata_eligible: true,
          eligibilite_json: null,
          plans_paiement_autorises_json: null,
          plan_paiement_defaut_code: null,
        },
      ],
    });

    const issues = validateInitialSetupFinanceCatalogues(payload);

    expect(issues).toEqual(
      expect.arrayContaining([
        "Le frais Scolarite CP doit rester annuel et ne peut pas etre recurrent.",
        "Le frais Scolarite CP doit utiliser le mode de facturation annuel.",
        "Le frais Scolarite CP doit definir au moins un plan annuel autorise.",
        "Le frais Scolarite CP doit definir un plan annuel par defaut.",
      ]),
    );
  });
});
