import PrismaService from "../../../service/prisma_service";

class MotifAbsenceModel extends PrismaService {
  constructor() {
    super("motifAbsence", {
      motifAbsence: ["justificatifs"],
    });
  }
}

export default MotifAbsenceModel;
