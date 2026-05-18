/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInscriptionCreateStore } from "../../store/InscriptionCreateStore";
import EleveService from "../../../../../services/eleve.service";
import EnrollmentDraftService from "../../../../../services/enrollmentDraft.service";
import type { Eleve } from "../../../../../types/models";
import { useInfo } from "../../../../../hooks/useInfo";

type Option = { value: string; label: string };

export default function ReinscriptionForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const navigate = useNavigate();
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

  const [eleveOptions, setEleveOptions] = useState<Option[]>([]);
  const draftService = useMemo(() => new EnrollmentDraftService(), []);

  useEffect(() => {
    if (etablissement_id) {
      getEtablissementOptions(etablissement_id);
    }
  }, [etablissement_id, getEtablissementOptions]);

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
              label: `${e.code_eleve ?? "-"} - ${e.utilisateur?.profil?.prenom ?? ""} ${e.utilisateur?.profil?.nom ?? ""}`.trim(),
            })) ?? [];
          setEleveOptions(options);
        }
      } catch (error) {
        console.error("Erreur chargement eleves", error);
        info("Impossible de charger la liste des eleves", "error");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [etablissement_id, anneeScolaireId, info, setLoading]);

  const reinscriptionSchema = useMemo(
    () =>
      z.object({
        eleve_id: z.string().min(1, "Selectionnez un eleve"),
        classe_id: z.string().min(1, "Selectionnez une classe"),
        date_inscription: z.coerce.date(),
        statut_inscription: z.string().default("INSCRIT").optional(),
      }),
    [],
  );

  const fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(reinscriptionSchema, {
        labelByField: {
          eleve_id: "Eleve",
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
                { value: "TRANSFERE", label: "TRANSFERE" },
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
        info("Annee scolaire non chargee, rechargez la page.", "error");
        return;
      }

      const res = await draftService.createFromStudent(data.eleve_id, {
        etablissement_id,
        annee_scolaire_id: anneeScolaireId,
        draft_type: "RE_ENROLLMENT",
        schooling_data: {
          classe_id: data.classe_id,
          date_inscription: data.date_inscription
            ? new Date(data.date_inscription).toISOString()
            : new Date().toISOString(),
          statut_inscription: data.statut_inscription ?? "INSCRIT",
        },
      });

      if (!res?.status?.success) {
        throw new Error("Creation impossible");
      }

      info("Brouillon de reinscription cree avec succes.", "success");
      navigate(`/scolarite/inscriptions/brouillons/${res.data.id}`);
    } catch (error) {
      console.error("Erreur reinscription:", error);
      info("Echec de la creation du brouillon de reinscription.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Reinscrire un eleve existant
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Selectionnez l'eleve, la classe cible et la date d'inscription. Un brouillon pre-rempli sera cree avant finalisation.
      </p>

      <Form
        schema={reinscriptionSchema}
        fields={fields}
        initialValues={initialValues}
        dataOnly={handleSubmit}
        labelMessage="Creer le brouillon"
      />
    </div>
  );
}
