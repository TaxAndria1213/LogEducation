import PrismaService from "../../../service/prisma_service";

class EvaluationModel extends PrismaService {
    constructor() {
        super("evaluation");
    }
}

export default EvaluationModel;
