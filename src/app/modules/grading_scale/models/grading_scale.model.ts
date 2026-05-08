import PrismaService from "../../../service/prisma_service";

class GradingScaleModel extends PrismaService {
  constructor() {
    super("gradingScale");
  }
}

export default GradingScaleModel;
