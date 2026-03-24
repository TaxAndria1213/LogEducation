import PrismaService from "../../../service/prisma_service";

class IncidentDisciplinaireModel extends PrismaService {
  constructor() {
    super("incidentDisciplinaire", {
      incidentDisciplinaire: [
        "eleve",
        "eleve.utilisateur",
        "eleve.utilisateur.profil",
        "sanctions",
      ],
    });
  }
}

export default IncidentDisciplinaireModel;
