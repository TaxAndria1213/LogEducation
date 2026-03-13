/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInscriptionCreateStore, type InscriptionCreateInput } from "../../store/InscriptionCreateStore";
import EleveService from "../../../../../services/eleve.service";
import type { Eleve } from "../../../../../types/models";
import { useInfo } from "../../../../../hooks/useInfo";

type Option = { value: string; label: string };

export default function ReinscriptionForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const getEtablissementOptions = useInscriptionCreateStore(
    (state) => state.getInscriptionOptions,
  );
  const anneeScolaireId = useInscriptionCreateStore(
    (state) => state.anneeScolaireId,
  );
  const classeOptions = useInscriptionCreateStore(
    (state) => state.classeOptions,
  );
  const setLoading = useInscriptionCreateStore((state) => state.setLoading);
  const onCreateInscription = useInscriptionCreateStore(
    (state) => state.onCreate,
  );

  const [eleveOptions, setEleveOptions] = useState<Option[]>([]);

  // Charger classes + année courante
  useEffect(() => {
    if (etablissement_id) {
      getEtablissementOptions(etablissement_id);
    }
  }, [etablissement_id, getEtablissementOptions]);

  // Charger la liste des élèves pour l'établissement (exclut ceux déjà inscrits sur l'année courante)
  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) return;
      setLoading(true);
      try {
        const service = new EleveService();
        const res = await service.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id,
            ...(anneeScolaireId
              ? {
                  inscriptions: {
                    none: { annee_scolaire_id: anneeScolaireId },
                  },
                }
              : {}),
          }),
          includeSpec: JSON.stringify({
            utilisateur: { include: { profil: true } },
          }),
          orderBy: JSON.stringify({ created_at: "desc" }),
        });

        if (res?.status?.success) {
          const options =
            res.data.data.map((e: Eleve) => ({
              value: e.id,
              label: `${e.code_eleve ?? "—"} · ${e.utilisateur?.profil?.prenom ?? ""} ${e.utilisateur?.profil?.nom ?? ""}`.trim(),
            })) ?? [];
          setEleveOptions(options);
        }
      } catch (error) {
        console.error("Erreur chargement élèves", error);
        info("Impossible de charger la liste des élèves", "error");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [etablissement_id, anneeScolaireId, info, setLoading]);

  const reinscriptionSchema = useMemo(
    () =>
      z.object({
        eleve_id: z.string().min(1, "Sélectionnez un élève"),
        classe_id: z.string().min(1, "Sélectionnez une classe"),
        date_inscription: z.coerce.date(),
        statut_inscription: z
          .string()
          .default("INSCRIT")
          .optional(),
      }),
    [],
  );

  const fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(reinscriptionSchema, {
        labelByField: {
          eleve_id: "Élève",
          classe_id: "Classe",
          date_inscription: "Date d'inscription",
          statut_inscription: "Statut",
        },
        metaByField: {
          eleve_id: {
            relation: { options: eleveOptions },
          },
          classe_id: {
            relation: { options: classeOptions },
          },
          date_inscription: { dateMode: "date" },
          statut_inscription: {
            relation: {
              options: [
                { value: "INSCRIT", label: "INSCRIT" },
                { value: "TRANSFERE", label: "TRANSFÉRÉ" },
              ],
            },
          },
        },
      }),
    [reinscriptionSchema, eleveOptions, classeOptions],
  );

  const initialValues = useMemo(
    () => ({
      date_inscription: new Date().toISOString(),
      statut_inscription: "INSCRIT",
    }),
    [],
  );

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true);

      if (!anneeScolaireId) {
        info("Année scolaire non chargée, rechargez la page.", "error");
        return;
      }

      const payload: InscriptionCreateInput = {
        eleve_id: data.eleve_id,
        classe_id: data.classe_id,
        annee_scolaire_id: anneeScolaireId,
        date_inscription: data.date_inscription
          ? new Date(data.date_inscription)
          : new Date(),
        statut: data.statut_inscription ?? "INSCRIT",
      };

      const res = await onCreateInscription(payload as InscriptionCreateInput);
      if (!res?.status?.success) {
        throw new Error("Création impossible");
      }

      info("Réinscription enregistrée.", "success");
    } catch (error) {
      console.error("Erreur reinscription:", error);
      info("Échec de la réinscription.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Réinscrire un élève existant
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Sélectionnez l'élève, la classe cible et la date d'inscription pour la nouvelle année scolaire.
      </p>

      <Form
        schema={reinscriptionSchema}
        fields={fields}
        initialValues={initialValues}
        dataOnly={handleSubmit}
        labelMessage="Réinscription"
      />
    </div>
  );
}
