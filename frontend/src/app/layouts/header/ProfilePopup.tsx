import { useAuth } from "../../../auth/AuthContext";
import ListContainer from "../../../components/sidebar/ListContainer";
import Text from "../../../components/text/Text";

function ProfilePopup() {
  const { profil } = useAuth();
  return (
    <div>
      <div>
        <Text>{profil?.nom}</Text>
        <Text>{profil?.prenom}</Text>
      </div>
      <ListContainer components={[]} />
    </div>
  );
}

export default ProfilePopup;
