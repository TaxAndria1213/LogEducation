import PrismaService from "../../../service/prisma_service";

class LigneTransportModel extends PrismaService {
  constructor() {
    super("ligneTransport", {
      ligneTransport: ["arrets"],
    });
  }
}

export default LigneTransportModel;
