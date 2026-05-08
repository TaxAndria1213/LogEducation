import PrismaService from "../../../service/prisma_service";

class ReportCardTemplateModel extends PrismaService {
  constructor() {
    super("reportCardTemplate");
  }
}

export default ReportCardTemplateModel;
