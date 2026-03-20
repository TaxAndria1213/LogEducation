import PrismaService from "../../../service/prisma_service";

class JustificatifAbsenceModel extends PrismaService {
  constructor() {
    super("justificatifAbsence", {
      justificatifAbsence: ["eleve", "eleve.utilisateur", "eleve.utilisateur.profil", "motif"],
    });
  }
}

export default JustificatifAbsenceModel;
