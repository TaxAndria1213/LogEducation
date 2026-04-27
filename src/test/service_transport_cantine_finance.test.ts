import AbonnementCantineApp from "../app/modules/abonnement_cantine/application/abonnement_cantine.app";
import AbonnementTransportApp from "../app/modules/abonnement_transport/application/abonnement_transport.app";
import { createServiceSubscriptionFacture } from "../app/modules/finance_shared/utils/service_subscription_finance";
import { assessBillingReadiness } from "../app/modules/finance_shared/utils/billing_readiness";

jest.mock("../app/modules/finance_shared/utils/billing_readiness", () => ({
  assessBillingReadiness: jest.fn(),
}));

describe("Finance transport/cantine service corrections", () => {
  const cantineService = new AbonnementCantineApp({} as never) as any;
  const transportService = new AbonnementTransportApp({} as never) as any;
  const mockedAssessBillingReadiness = assessBillingReadiness as jest.MockedFunction<
    typeof assessBillingReadiness
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAssessBillingReadiness.mockResolvedValue({
      ready: true,
      annee_scolaire_id: "annee-1",
      annee_label: "2026-2027",
      approved_recurring_count: 0,
      active_inscriptions_count: 0,
      periodes_count: 0,
      selected_catalogues_count: 1,
      pending_catalogues_count: 0,
      issues: [],
    });
  });

  test("calcule une regularisation d'absence cantine au repas et non au forfait complet", () => {
    const amount = cantineService.computeCantineAbsenceRegularizationAmount({
      formule: {
        type_formule: "FORFAIT",
        max_repas_par_jour: 2,
        frais: { montant: 304000 },
      },
      abonnement: {
        date_effet: new Date("2026-10-01T00:00:00.000Z"),
        annee: {
          date_debut: new Date("2026-10-01T00:00:00.000Z"),
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        },
      },
      absenceDate: new Date("2026-11-10T00:00:00.000Z"),
    });

    expect(amount).toBe(500);
  });

  test("ne regularise pas une absence cantine sur une formule repas unitaire prepaye", () => {
    const amount = cantineService.computeCantineAbsenceRegularizationAmount({
      formule: {
        type_formule: "REPAS_UNITAIRE",
        max_repas_par_jour: 1,
        frais: { montant: 120000 },
      },
      abonnement: {
        date_effet: new Date("2026-10-01T00:00:00.000Z"),
        annee: {
          date_debut: new Date("2026-10-01T00:00:00.000Z"),
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        },
      },
      absenceDate: new Date("2026-11-10T00:00:00.000Z"),
    });

    expect(amount).toBe(0);
  });

  test("calcule le montant restant cantine a partir de la date d'effet", () => {
    const amount = cantineService.computeCantineRemainingAmount({
      montant: 304000,
      formuleType: "FORFAIT",
      subscriptionStart: new Date("2026-10-01T00:00:00.000Z"),
      schoolYearStart: new Date("2026-10-01T00:00:00.000Z"),
      schoolYearEnd: new Date("2027-07-31T00:00:00.000Z"),
      effectiveDate: new Date("2027-02-01T00:00:00.000Z"),
    });

    expect(amount).toBe(181000);
  });

  test("calcule le montant restant transport au prorata restant et pas au plein tarif", () => {
    const amount = transportService.computeTransportRemainingAmount(
      {
        prorata_ratio: 1,
        zone_transport: "ZONE_A",
        date_debut_service: new Date("2026-10-01T00:00:00.000Z"),
        date_fin_service: new Date("2027-07-31T00:00:00.000Z"),
        annee: {
          date_debut: new Date("2026-10-01T00:00:00.000Z"),
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        },
        ligne: {
          infos_vehicule_json: {
            zones: ["ZONE_A"],
            zone_tarifs: { ZONE_A: 304000 },
            prorata_mode: "SCHOOL_YEAR",
          },
          frais: { montant: 304000 },
        },
      },
      new Date("2027-02-01T00:00:00.000Z"),
    );

    expect(amount).toBe(181001.6);
  });

  test("refuse la facturation d'un frais service non approuve", async () => {
    const tx = {
      inscription: {
        findUnique: jest.fn().mockResolvedValue({
          classe: { niveau_scolaire_id: "niveau-1" },
        }),
      },
      anneeScolaire: {
        findFirst: jest.fn().mockResolvedValue({
          id: "annee-1",
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        }),
      },
      catalogueFrais: {
        findFirst: jest.fn().mockResolvedValue({
          id: "cat-1",
          nom: "Transport scolaire",
          montant: 120000,
          devise: "MGA",
          niveau_scolaire_id: "niveau-1",
          usage_scope: "TRANSPORT",
          statut_validation: "EN_ATTENTE",
          mode_facturation: "PONCTUEL",
        }),
      },
    } as any;

    await expect(
      createServiceSubscriptionFacture(tx, {
        tenantId: "etab-1",
        eleveId: "eleve-1",
        anneeScolaireId: "annee-1",
        catalogueFraisId: "cat-1",
        allowedScopes: ["GENERAL", "TRANSPORT"],
        libelle: "Transport - Circuit A",
        modePaiement: "COMPTANT",
      }),
    ).rejects.toThrow("Le frais selectionne doit etre approuve avant facturation.");
  });

  test("refuse la facturation service si la readiness finance bloque le catalogue", async () => {
    mockedAssessBillingReadiness.mockResolvedValueOnce({
      ready: false,
      annee_scolaire_id: "annee-1",
      annee_label: "2026-2027",
      approved_recurring_count: 0,
      active_inscriptions_count: 0,
      periodes_count: 0,
      selected_catalogues_count: 1,
      pending_catalogues_count: 1,
      issues: [
        {
          code: "UNAPPROVED_SELECTED_CATALOGUES",
          message: "Le catalogue doit etre approuve avant facturation.",
          severity: "error",
        },
      ],
    });

    const tx = {
      inscription: {
        findUnique: jest.fn().mockResolvedValue({
          classe: { niveau_scolaire_id: "niveau-1" },
        }),
      },
      anneeScolaire: {
        findFirst: jest.fn().mockResolvedValue({
          id: "annee-1",
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        }),
      },
      catalogueFrais: {
        findFirst: jest.fn(),
      },
    } as any;

    await expect(
      createServiceSubscriptionFacture(tx, {
        tenantId: "etab-1",
        eleveId: "eleve-1",
        anneeScolaireId: "annee-1",
        catalogueFraisId: "cat-1",
        allowedScopes: ["GENERAL", "CANTINE"],
        libelle: "Cantine - Formule A",
        modePaiement: "COMPTANT",
      }),
    ).rejects.toThrow("Le catalogue doit etre approuve avant facturation.");
  });

  test("refuse un echeancier service qui depasse la fin de l'annee scolaire", async () => {
    const tx = {
      inscription: {
        findUnique: jest.fn().mockResolvedValue({
          classe: { niveau_scolaire_id: "niveau-1" },
        }),
      },
      anneeScolaire: {
        findFirst: jest.fn().mockResolvedValue({
          id: "annee-1",
          date_fin: new Date("2027-07-31T00:00:00.000Z"),
        }),
      },
      catalogueFrais: {
        findFirst: jest.fn().mockResolvedValue({
          id: "cat-1",
          nom: "Transport scolaire",
          montant: 120000,
          devise: "MGA",
          niveau_scolaire_id: "niveau-1",
          usage_scope: "TRANSPORT",
          statut_validation: "APPROUVEE",
          mode_facturation: "PONCTUEL",
        }),
      },
    } as any;

    await expect(
      createServiceSubscriptionFacture(tx, {
        tenantId: "etab-1",
        eleveId: "eleve-1",
        anneeScolaireId: "annee-1",
        catalogueFraisId: "cat-1",
        allowedScopes: ["GENERAL", "TRANSPORT"],
        libelle: "Transport - Circuit A",
        modePaiement: "ECHELONNE",
        nombreTranches: 10,
        jourPaiementMensuel: 5,
        dateEmission: new Date("2026-10-12T00:00:00.000Z"),
        dateEcheance: new Date("2026-10-12T00:00:00.000Z"),
      }),
    ).rejects.toThrow("depasse la fin de l'annee scolaire");
  });
});
