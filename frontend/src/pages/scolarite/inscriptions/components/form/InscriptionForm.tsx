/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { ProfilSchema } from "../../../../../generated/zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import {
  MultiStepFormWizard,
  type WizardStep,
} from "../../../../../components/Form/multistep/MultiStepFormWizard";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInscriptionCreateStore } from "../../store/InscriptionCreateStore";

type WizardData = {
  eleve?: any;
  scolarite?: any;
  tuteur?: any;
  services?: any;
  finance?: any;
  echeancier?: any;
};

export default function InscriptionForm() {
  const {etablissement_id} = useAuth();
  const getEtablissementOptions = useInscriptionCreateStore((state) => state.getInscriptionOptions)

  useEffect(() => {
    if(etablissement_id) {
      getEtablissementOptions(etablissement_id);
    }
  }, [etablissement_id, getEtablissementOptions]);

  //// options
  const classeOptions = useInscriptionCreateStore((state) => state.classeOptions);

  //// initial datas
  const scolariteInitialData = useInscriptionCreateStore((state) => state.scolariteInitialData);

  /**
   * -------------------------------------------------------
   * 1) ÉTAPE ÉLÈVE
   * -------------------------------------------------------
   * On réutilise ProfilSchema pour les infos personnelles.
   */
  const eleveFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(ProfilSchema, {
        omit: [
          "id",
          "created_at",
          "updated_at",
          "utilisateur_id",
          "contact_urgence_json",
          "photo_url",
        ],
        labelByField: {
          prenom: "Prénom",
          nom: "Nom",
          date_naissance: "Date de naissance",
          genre: "Genre",
          adresse: "Adresse",
        },
        metaByField: {
          date_naissance: { dateMode: "date" },
          genre: {
            relation: {
              options: [
                { value: "Homme", label: "Homme" },
                { value: "Femme", label: "Femme" },
              ],
            },
          },
        },
      }),
    [],
  );

  const eleveSchema = useMemo(
    () =>
      ProfilSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        utilisateur_id: true,
        contact_urgence_json: true,
        photo_url: true,
      }),
    [],
  );

  /**
   * -------------------------------------------------------
   * 2) ÉTAPE SCOLARITÉ
   * -------------------------------------------------------
   */
  const scolariteSchema = useMemo(
    () =>
      z.object({
        code_eleve: z.string().optional().nullable(),
        classe_id: z.string(),
        date_entree: z.coerce.date().nullable(),
        date_inscription: z.coerce.date(),
        statut_inscription: z.string(),
      }),
    [],
  );

  const scolariteFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(scolariteSchema, {
        labelByField: {
          code_eleve: "Code élève",
          classe_id: "Classe",
          date_entree: "Date d'entrée",
          date_inscription: "Date d'inscription",
          statut_inscription: "Statut d'inscription",
        },
        metaByField: {
          date_entree: { dateMode: "date" },
          date_inscription: { dateMode: "date" },
          statut_inscription: {
            relation: {
              options: [{ value: "INSCRIT", label: "INSCRIT" }],
            },
          },
          classe_id: {
            relation: {
              options: classeOptions,
            },
          }
        },
      }),
    [scolariteSchema, classeOptions],
  );

  /**
   * -------------------------------------------------------
   * 3) ÉTAPE TUTEUR PRINCIPAL
   * -------------------------------------------------------
   */

  const tuteur1Schema = useMemo(
    () =>
      {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return z.object({
        nom: z.string().min(1, "Champ requis"),
        prenom: z.string().min(1, "Champ requis"),
        telephone: z.string().optional().nullable(),
        email: z.string().regex(emailRegex, {
          message: "Format d'email incorrect.",
        }).optional().nullable(),
        adresse: z.string().optional().nullable(),
        relation: z.string().min(1, "Champ requis"),
        est_principal: z.string().default("true"),
        autorise_recuperation: z.string().default("true"),
      })
      },
    [],
  );

  const tuteur1Fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(tuteur1Schema, {
        labelByField: {
          nom: "Nom",
          prenom: "Prénom",
          telephone: "Téléphone",
          email: "Email",
          adresse: "Adresse",
          relation: "Relation avec l'élève",
          est_principal: "Tuteur principal",
          autorise_recuperation: "Autorisé à récupérer l'élève",
        },
        metaByField: {
          relation: {
            relation: {
              options: [
                { value: "Père", label: "Père" },
                { value: "Mère", label: "Mère" },
                { value: "Tuteur", label: "Tuteur" },
                { value: "Autre", label: "Autre" },
              ],
            },
          },
          est_principal: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
          autorise_recuperation: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
        },
      }),
    [tuteur1Schema],
  );

  /**
   * -------------------------------------------------------
   * 3) ÉTAPE TUTEUR PRINCIPAL
   * -------------------------------------------------------
   */

  const tuteur2Schema = useMemo(
    () =>
      {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return z.object({
        nom: z.string().optional().nullable(),
        prenom: z.string().optional().nullable(),
        telephone: z.string().optional().nullable(),
        email: z.string().regex(emailRegex, {
          message: "Format d'email incorrect.",
        }).optional().nullable(),
        adresse: z.string().optional().nullable(),
        relation: z.string().optional().nullable(),
        est_principal: z.string().default("true"),
        autorise_recuperation: z.string().default("true"),
      })
      },
    [],
  );

  const tuteur2Fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(tuteur2Schema, {
        labelByField: {
          nom: "Nom",
          prenom: "Prénom",
          telephone: "Téléphone",
          email: "Email",
          adresse: "Adresse",
          relation: "Relation avec l'élève",
          est_principal: "Tuteur principal",
          autorise_recuperation: "Autorisé à récupérer l'élève",
        },
        metaByField: {
          relation: {
            relation: {
              options: [
                { value: "Père", label: "Père" },
                { value: "Mère", label: "Mère" },
                { value: "Tuteur", label: "Tuteur" },
                { value: "Autre", label: "Autre" },
              ],
            },
          },
          est_principal: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
          autorise_recuperation: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
        },
      }),
    [tuteur2Schema],
  );

  /**
   * -------------------------------------------------------
   * 4) ÉTAPE SERVICES
   * -------------------------------------------------------
   */
  const servicesSchema = useMemo(
    () =>
      z.object({
        transport_active: z.string().default("false"),
        ligne_transport_id: z.string().optional().nullable(),
        arret_transport_id: z.string().optional().nullable(),
        cantine_active: z.string().default("false"),
        formule_cantine_id: z.string().optional().nullable(),
      }),
    [],
  );

  const servicesFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(servicesSchema, {
        labelByField: {
          transport_active: "Activer le transport",
          ligne_transport_id: "Ligne de transport",
          arret_transport_id: "Arrêt de transport",
          cantine_active: "Activer la cantine",
          formule_cantine_id: "Formule cantine",
        },
        metaByField: {
          transport_active: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
          cantine_active: {
            relation: {
              options: [
                { value: "true", label: "Oui" },
                { value: "false", label: "Non" },
              ],
            },
          },
        },
      }),
    [servicesSchema],
  );

  /**
   * -------------------------------------------------------
   * 5) ÉTAPE PLAN FINANCIER
   * -------------------------------------------------------
   */
  const financeSchema = useMemo(
    () =>
      z.object({
        frais_inscription: z.coerce.number().min(0).default(0),
        frais_scolarite: z.coerce.number().min(0).default(0),
        frais_transport: z.coerce.number().min(0).default(0),
        frais_cantine: z.coerce.number().min(0).default(0),
        remise_type: z.string().default("AUCUNE"),
        remise_valeur: z.coerce.number().min(0).default(0),
        devise: z.string().default("MGA"),
      }),
    [],
  );

  const financeFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(financeSchema, {
        labelByField: {
          frais_inscription: "Frais d'inscription",
          frais_scolarite: "Frais de scolarité",
          frais_transport: "Frais de transport",
          frais_cantine: "Frais de cantine",
          remise_type: "Type de remise",
          remise_valeur: "Valeur de la remise",
          devise: "Devise",
        },
        metaByField: {
          remise_type: {
            relation: {
              options: [
                { value: "AUCUNE", label: "Aucune" },
                { value: "PERCENT", label: "Pourcentage" },
                { value: "FIXED", label: "Montant fixe" },
              ],
            },
          },
          devise: {
            relation: {
              options: [
                { value: "MGA", label: "MGA" },
                { value: "EUR", label: "EUR" },
                { value: "USD", label: "USD" },
              ],
            },
          },
        },
      }),
    [financeSchema],
  );

  /**
   * -------------------------------------------------------
   * 6) ÉTAPE ÉCHÉANCIER
   * -------------------------------------------------------
   */
  const echeancierSchema = useMemo(
    () =>
      z.object({
        mode_paiement: z.string().min(1, "Champ requis"),
        nombre_tranches: z.coerce.number().min(1).default(1),
        premiere_echeance: z.string().min(1, "Champ requis"),
        notes: z.string().optional().nullable(),
      }),
    [],
  );

  const echeancierFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(echeancierSchema, {
        labelByField: {
          mode_paiement: "Mode de paiement",
          nombre_tranches: "Nombre de tranches",
          premiere_echeance: "Première échéance",
          notes: "Notes",
        },
        metaByField: {
          mode_paiement: {
            relation: {
              options: [
                { value: "COMPTANT", label: "Comptant" },
                { value: "TRANCHES", label: "En tranches" },
                { value: "MENSUEL", label: "Mensuel" },
              ],
            },
          },
          premiere_echeance: { dateMode: "date" },
        },
      }),
    [echeancierSchema],
  );

  const steps: WizardStep[] = useMemo(
    () =>
      [
        {
          key: "eleve",
          title: "Informations élève",
          desc: "Identité et informations personnelles",
          schema: eleveSchema,
          fields: eleveFields,
          labelMessage: "Élève",
        },
        {
          key: "scolarite",
          title: "Scolarité",
          desc: "Affectation scolaire de l'élève",
          schema: scolariteSchema,
          fields: scolariteFields,
          initialValues: scolariteInitialData,
          labelMessage: "Scolarité",
        },
        {
          key: "tuteur1",
          title: "Tuteur principal / Parent 1",
          desc: "Responsable légal principal",
          schema: tuteur1Schema,
          fields: tuteur1Fields,
          labelMessage: "Tuteur",
        },
        {
          key: "tuteur2",
          title: "Tuteur / Parent 2",
          desc: "Responsable légal",
          schema: tuteur2Schema,
          fields: tuteur2Fields,
          labelMessage: "Tuteur",
        },
        {
          key: "services",
          title: "Services",
          desc: "Transport et cantine",
          schema: servicesSchema,
          fields: servicesFields,
          labelMessage: "Services",
        },
        {
          key: "finance",
          title: "Plan financier",
          desc: "Frais, remises et devise",
          schema: financeSchema,
          fields: financeFields,
          labelMessage: "Finance",
        },
        {
          key: "echeancier",
          title: "Échéancier",
          desc: "Mode de paiement et première échéance",
          schema: echeancierSchema,
          fields: echeancierFields,
          labelMessage: "Échéancier",
        },
      ] as WizardStep[],
    [
      eleveSchema,
      eleveFields,
      scolariteSchema,
      scolariteFields,
      scolariteInitialData,
      tuteur1Schema,
      tuteur1Fields,
      tuteur2Schema,
      tuteur2Fields,
      servicesSchema,
      servicesFields,
      financeSchema,
      financeFields,
      echeancierSchema,
      echeancierFields,
    ],
  );

  const handleFinish = async (finalData: WizardData) => {
    console.log("✅ DONNÉES FINALES INSCRIPTION ÉLÈVE :", finalData);
  };

  return (
    <MultiStepFormWizard
      title="Inscrire un élève"
      subtitle="Complétez les étapes de l'inscription, de la fiche élève jusqu'au plan financier."
      steps={steps}
      onFinish={handleFinish}
    />
  );
}