import PrismaService from "../../../service/prisma_service";

class EmpruntModel extends PrismaService {
  constructor() {
    super("emprunt", {
      emprunt: ["ressource", "eleve", "personnel"],
    });
  }
}

export default EmpruntModel;
