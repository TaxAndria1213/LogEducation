import PrismaService from "../../../service/prisma_service";

class RecompenseModel extends PrismaService {
  constructor() {
    super("recompense", {
      recompense: ["eleve", "eleve.utilisateur", "eleve.utilisateur.profil"],
    });
  }
}

export default RecompenseModel;
