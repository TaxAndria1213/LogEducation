import PrismaService from "../../../service/prisma_service";

class RessourceBibliothequeModel extends PrismaService {
  constructor() {
    super("ressourceBibliotheque", {
      ressourceBibliotheque: ["emprunts"],
    });
  }
}

export default RessourceBibliothequeModel;
