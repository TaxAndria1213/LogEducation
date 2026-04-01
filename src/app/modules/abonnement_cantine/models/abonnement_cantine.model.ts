import PrismaService from "../../../service/prisma_service";

class AbonnementCantineModel extends PrismaService {
  constructor() {
    super("abonnementCantine", {
      abonnementCantine: ["eleve", "annee", "formule"],
    });
  }
}

export default AbonnementCantineModel;
