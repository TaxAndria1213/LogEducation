import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { ProfilSchema } from "../../../../../generated/zod";
import ProfileService from "../../../../../services/profile.service";
import { useProfileCreateStore } from "../../store/ProfileCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Profil } from "../../../../../types/models";

function ProfileForm() {
  const { etablissement_id } = useAuth();
  const service = new ProfileService();
  const loading = useProfileCreateStore((state) => state.loading);
  const utilisateurOptions = useProfileCreateStore(
    (state) => state.utilisateurOptions,
  );
  const initialValues = useProfileCreateStore((state) => state.initialValues);
  const getUtilisateurOptions = useProfileCreateStore(
    (state) => state.getUtilisateurOptions,
  );

  useEffect(() => {
    void getUtilisateurOptions(etablissement_id);
  }, [etablissement_id, getUtilisateurOptions]);

  const profileFields = getFieldsFromZodObjectSchema(ProfilSchema, {
    omit: ["id", "created_at", "updated_at", "contact_urgence_json", "photo_url"],
    metaByField: {
      date_naissance: { dateMode: "date" },
      utilisateur_id: {
        relation: {
          options: utilisateurOptions,
        },
      },
      genre: {
        relation: {
          options: [
            { value: "Homme", label: "Homme" },
            { value: "Femme", label: "Femme" },
          ],
        },
      },
    },
    labelByField: {
      utilisateur_id: "Utilisateur",
      prenom: "Prenom",
      nom: "Nom",
      date_naissance: "Date de naissance",
      genre: "Genre",
      adresse: "Adresse",
    },
  });

  const profileSchema = ProfilSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    contact_urgence_json: true,
    photo_url: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des utilisateurs..." showLabel />
      ) : (
        <Form
          schema={profileSchema}
          fields={profileFields}
          initialValues={initialValues as Partial<Profil>}
          service={service}
          labelMessage={"Profil"}
        />
      )}
    </div>
  );
}

export default ProfileForm;
