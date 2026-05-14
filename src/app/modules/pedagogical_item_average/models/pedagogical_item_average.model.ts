import PrismaService from "../../../service/prisma_service";

class PedagogicalItemAverageModel extends PrismaService {
  constructor() {
    super("pedagogicalItemAverage");
  }
}

export default PedagogicalItemAverageModel;
