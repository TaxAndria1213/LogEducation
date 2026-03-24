import PrismaService from "../../../service/prisma_service";

class SanctionDisciplinaireModel extends PrismaService {
  constructor() {
    super("sanctionDisciplinaire", {
      sanctionDisciplinaire: [
        "incident",
        "incident.eleve",
        "incident.eleve.utilisateur",
        "incident.eleve.utilisateur.profil",
      ],
    });
  }
}

export default SanctionDisciplinaireModel;
