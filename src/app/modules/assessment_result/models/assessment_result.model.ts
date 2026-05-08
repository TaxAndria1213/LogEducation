import PrismaService from "../../../service/prisma_service";

class AssessmentResultModel extends PrismaService {
  constructor() {
    super("assessmentResult");
  }
}

export default AssessmentResultModel;
