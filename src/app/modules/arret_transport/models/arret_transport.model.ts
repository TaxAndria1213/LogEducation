import PrismaService from "../../../service/prisma_service";

class ArretTransportModel extends PrismaService {
  constructor() {
    super("arretTransport", {
      arretTransport: ["ligne"],
    });
  }
}

export default ArretTransportModel;
