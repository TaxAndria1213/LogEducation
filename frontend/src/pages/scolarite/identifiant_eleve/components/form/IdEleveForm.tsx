import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { Form } from "../../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { useAuth } from "../../../../../auth/AuthContext";
import { IdentifiantEleveSchema } from "../../../../../generated/zod";
import EleveService from "../../../../../services/eleve.service";
import IdentifiantEleveService from "../../../../../services/identifiantEleve.service";
import ReferencielService, {
  buildReferentialOptions,
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
import type { IdentifiantEleve } from "../../../../../types/models";
import { useIdentifiantEleveCreateStore } from "../../store/IdEleveCreateStore";

function IdentifiantEleveForm() {
  const { etablissement_id } = useAuth();
  const service = new IdentifiantEleveService();
  const loading = useIdentifiantEleveCreateStore((state) => state.loading);
  const initialData = useIdentifiantEleveCreateStore((state) => state.initialData);
  const setInitialData = useIdentifiantEleveCreateStore((state) => state.setInitialData);
  const [eleveOptions, setEleveOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [referentialCatalog, setReferentialCatalog] = useState<
    ReferentialCatalogItem[]
  >([]);

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({});
    }
  }, [etablissement_id, setInitialData]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;

      const eleveService = new EleveService();
      const referencielService = new ReferencielService();

      const [eleveResult, referentielResult] = await Promise.all([
        eleveService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({
            utilisateur: { include: { profil: true } },
          }),
        }),
        referencielService.getCatalog(),
      ]);

      setEleveOptions(
        eleveResult?.status.success
          ? eleveResult.data.data.map((item: any) => ({
              value: item.id,
              label:
                item.utilisateur?.profil?.prenom && item.utilisateur?.profil?.nom
                  ? `${item.utilisateur.profil.prenom} ${item.utilisateur.profil.nom}`
                  : item.code_eleve ?? item.id,
            }))
          : [],
      );

      setReferentialCatalog(
        referentielResult?.status.success
          ? ((referentielResult.data as ReferentialCatalogItem[]) ?? [])
          : [],
      );
    };

    void load();
  }, [etablissement_id]);

  const typeOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "IDENTIFIANT_ELEVE_TYPE", [
        "CARTE_SCOLAIRE",
        "MATRICULE",
        "CIN",
        "ACTE_NAISSANCE",
      ]),
    [referentialCatalog],
  );

  const identifiantEleveFields = getFieldsFromZodObjectSchema(
    IdentifiantEleveSchema,
    {
      omit: ["id", "created_at", "updated_at"],
      metaByField: {
        created_at: { dateMode: "datetime" },
        updated_at: { dateMode: "datetime" },
        eleve_id: {
          relation: {
            options: eleveOptions,
          },
        },
        type: {
          relation: {
            options: typeOptions,
          },
        },
        delivre_le: { dateMode: "date" },
        expire_le: { dateMode: "date" },
      },
      labelByField: {
        eleve_id: "Eleve",
        type: "Type",
        valeur: "Valeur",
        delivre_le: "Delivre le",
        expire_le: "Expire le",
      },
    },
  );

  const identifiantEleveSchema = IdentifiantEleveSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={identifiantEleveSchema}
          fields={identifiantEleveFields}
          initialValues={initialData as Partial<IdentifiantEleve>}
          service={service}
          labelMessage={"Identifiant"}
        />
      )}
    </div>
  );
}

export default IdentifiantEleveForm;
