import PrismaService from "../../../service/prisma_service";

class PresenceEleveModel extends PrismaService {
  constructor() {
    super("presenceEleve", {
      presenceEleve: ["session", "session.classe", "session.creneau", "eleve", "eleve.utilisateur", "eleve.utilisateur.profil"],
    });
  }
}

export default PresenceEleveModel;
