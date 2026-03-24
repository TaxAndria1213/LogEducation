import PrismaService from "../../../service/prisma_service";

class RemiseModel extends PrismaService {
  constructor() {
    super("remise", {
      remise: ["etablissement"],
    });
  }
}

export default RemiseModel;
