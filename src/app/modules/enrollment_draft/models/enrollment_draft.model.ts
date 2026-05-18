import PrismaService from "../../../service/prisma_service";

class EnrollmentDraftModel extends PrismaService {
  constructor() {
    super("enrollmentDraft");
  }
}

export default EnrollmentDraftModel;
