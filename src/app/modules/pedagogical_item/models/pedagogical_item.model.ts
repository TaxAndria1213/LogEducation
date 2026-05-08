import PrismaService from "../../../service/prisma_service";

class PedagogicalItemModel extends PrismaService {
  constructor() {
    super("pedagogicalItem");
  }
}

export default PedagogicalItemModel;
