import ERPPage from "../../../components/page/ERPPage";
import EtablissementProfileOverview from "./components/dashboard/EtablissementProfileOverview";

function ProfileEtablissementIndex() {
  return (
    <ERPPage
      title="Profil de l'etablissement"
      description="Vue globale de l'etablissement rattache au compte proprietaire. Les operations d'administration sont reservees a la plateforme administrateur."
    >
      <EtablissementProfileOverview />
    </ERPPage>
  );
}

export default ProfileEtablissementIndex;
