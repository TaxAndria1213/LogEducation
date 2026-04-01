import PrismaService from "../../../service/prisma_service";

class AbonnementTransportModel extends PrismaService {
  constructor() {
    super("abonnementTransport", {
      abonnementTransport: ["eleve", "annee", "ligne", "arret"],
    });
  }
}

export default AbonnementTransportModel;
