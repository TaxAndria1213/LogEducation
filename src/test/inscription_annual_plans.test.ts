import InscriptionApp from "../app/modules/inscription/application/inscription.app";
import { createRecurringExecutionIfNeeded } from "../app/modules/finance_shared/utils/recurring_billing";

describe("Inscription annual payment plans", () => {
  const service = new InscriptionApp({} as never) as any;

  test("selectionne le plan demande quand il est autorise", () => {
    const plan = service.resolvePaymentPlanForFee(
      {
        nombre_tranches: 10,
        plans_paiement_autorises_json: [
          { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
          { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 4, 8] },
          {
            code: "10X",
            label: "10 tranches",
            nombre_tranches: 10,
            offsets_mois: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        ],
        plan_paiement_defaut_code: "10X",
      },
      "3x",
      "le frais de scolarite",
    );

    expect(plan).toEqual({
      code: "3X",
      label: "3 tranches",
      nombre_tranches: 3,
      offsets_mois: [0, 4, 8],
    });
  });

  test("refuse un plan annuel non autorise", () => {
    expect(() =>
      service.resolvePaymentPlanForFee(
        {
          nombre_tranches: 10,
          plans_paiement_autorises_json: [
            { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
            {
              code: "10X",
              label: "10 tranches",
              nombre_tranches: 10,
              offsets_mois: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
          ],
          plan_paiement_defaut_code: "10X",
        },
        "3X",
        "le frais de scolarite",
      ),
    ).toThrow("Le plan choisi n'est pas autorise pour le frais de scolarite.");
  });

  test("selectionne le plan inscription demande quand il est autorise", () => {
    const plan = service.resolvePaymentPlanForFee(
      {
        nombre_tranches: 2,
        plans_paiement_autorises_json: [
          { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
          { code: "2X", label: "2 tranches", nombre_tranches: 2, offsets_mois: [0, 1] },
          { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 1, 2] },
        ],
        plan_paiement_defaut_code: "1X",
      },
      "2x",
      "le droit d'inscription",
    );

    expect(plan).toEqual({
      code: "2X",
      label: "2 tranches",
      nombre_tranches: 2,
      offsets_mois: [0, 1],
    });
  });

  test("genere les echeances annuelles selon le plan choisi et le jour du mois", () => {
    const schedule = service.buildPaymentSchedule(
      [
        {
          libelle: "Scolarite CP",
          montant: 1200000,
          nombre_tranches: 3,
          devise: "MGA",
          installment_offsets_months: [0, 4, 8],
        },
      ],
      0,
      "ECHELONNE",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2027-07-31T00:00:00.000Z"),
      new Date("2026-10-12T00:00:00.000Z"),
      5,
    );

    expect(schedule).toEqual([
      {
        date: "2026-11-05",
        montant: 400000,
        statut: "A_VENIR",
        note: "Scolarite CP - tranche 1/3",
        libelle: "Scolarite CP - tranche 1",
      },
      {
        date: "2027-03-05",
        montant: 400000,
        statut: "A_VENIR",
        note: "Scolarite CP - tranche 2/3",
        libelle: "Scolarite CP - tranche 2",
      },
      {
        date: "2027-07-05",
        montant: 400000,
        statut: "A_VENIR",
        note: "Scolarite CP - tranche 3/3",
        libelle: "Scolarite CP - tranche 3",
      },
    ]);
  });

  test("genere un plan annuel 10X entierement borne dans l'annee scolaire", () => {
    const schedule = service.buildPaymentSchedule(
      [
        {
          libelle: "Scolarite CP",
          montant: 1200000,
          nombre_tranches: 10,
          devise: "MGA",
          installment_offsets_months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        },
      ],
      0,
      "ECHELONNE",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2027-07-31T00:00:00.000Z"),
      new Date("2026-10-01T00:00:00.000Z"),
      5,
    );

    expect(schedule).toHaveLength(10);
    expect(schedule[0]?.date).toBe("2026-10-05");
    expect(schedule[9]?.date).toBe("2027-07-05");
  });

  test("refuse un echeancier annuel qui deborde hors de l'annee scolaire", () => {
    expect(() =>
      service.buildPaymentSchedule(
        [
          {
            libelle: "Scolarite CP",
            montant: 1200000,
            nombre_tranches: 10,
            devise: "MGA",
            installment_offsets_months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        ],
        0,
        "ECHELONNE",
        new Date("2026-10-01T00:00:00.000Z"),
        new Date("2027-07-31T00:00:00.000Z"),
        new Date("2026-10-12T00:00:00.000Z"),
        5,
      ),
    ).toThrow("depasse la fin de l'annee scolaire");
  });

  test("deduit un mode comptant quand la scolarite annuelle est en 1X", () => {
    const mode = service.deriveScheduleMode([
      {
        libelle: "Scolarite CP",
        montant: 1200000,
        catalogue_frais_id: "cat-sco",
        source_key: "catalogue_frais_scolarite_id",
        nombre_tranches: 1,
        installment_offsets_months: [0],
      },
    ]);

    expect(mode).toBe("COMPTANT");
  });

  test("deduit un mode echelonne des qu'une ligne contient plusieurs tranches", () => {
    const mode = service.deriveScheduleMode([
      {
        libelle: "Frais d'inscription",
        montant: 100000,
        catalogue_frais_id: "cat-insc",
        source_key: "catalogue_frais_inscription_id",
        nombre_tranches: 1,
        installment_offsets_months: null,
      },
      {
        libelle: "Scolarite CP",
        montant: 1200000,
        catalogue_frais_id: "cat-sco",
        source_key: "catalogue_frais_scolarite_id",
        nombre_tranches: 10,
        installment_offsets_months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    ]);

    expect(mode).toBe("ECHELONNE");
  });

  test("genere un echeancier inscription 2X sur deux mois", () => {
    const schedule = service.buildPaymentSchedule(
      [
        {
          libelle: "Droit d'inscription",
          montant: 120000,
          nombre_tranches: 2,
          devise: "MGA",
          installment_offsets_months: [0, 1],
        },
      ],
      0,
      "ECHELONNE",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2027-07-31T00:00:00.000Z"),
      new Date("2026-10-01T00:00:00.000Z"),
      5,
    );

    expect(schedule).toEqual([
      {
        date: "2026-10-05",
        montant: 60000,
        statut: "A_VENIR",
        note: "Droit d'inscription - tranche 1/2",
        libelle: "Droit d'inscription - tranche 1",
      },
      {
        date: "2026-11-05",
        montant: 60000,
        statut: "A_VENIR",
        note: "Droit d'inscription - tranche 2/2",
        libelle: "Droit d'inscription - tranche 2",
      },
    ]);
  });

  test("ignore une scolarite annuelle incoherente dans le moteur recurrent", async () => {
    const prisma = {
      catalogueFrais: {
        findFirst: jest.fn().mockResolvedValue({
          id: "cat-sco",
          periodicite: "monthly",
          usage_scope: "SCOLARITE",
          mode_facturation: "ANNUEL",
        }),
      },
      facturationRecurrenteExecution: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    } as any;

    const result = await createRecurringExecutionIfNeeded(prisma, {
      tenantId: "etab-1",
      eleveId: "eleve-1",
      anneeScolaireId: "annee-1",
      factureId: "facture-1",
      catalogueFraisId: "cat-sco",
      referenceDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(prisma.facturationRecurrenteExecution.findFirst).not.toHaveBeenCalled();
    expect(prisma.facturationRecurrenteExecution.create).not.toHaveBeenCalled();
  });
});
