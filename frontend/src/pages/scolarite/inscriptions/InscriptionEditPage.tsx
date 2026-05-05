import { useParams } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";
import InscriptionForm from "./components/form/InscriptionForm";

export default function InscriptionEditPage() {
  const { id } = useParams();

  return (
    <ERPPage
      title="Modifier l'inscription"
      description="Mettez a jour les informations administratives du dossier sans perdre les controles metier du resume."
      backButton={{
        to: id ? `/scolarite/inscriptions/${id}/resume` : "/scolarite/inscriptions",
        label: "Retour au resume d'inscription",
      }}
    >
      <InscriptionForm mode="edit" inscriptionId={id} />
    </ERPPage>
  );
}
