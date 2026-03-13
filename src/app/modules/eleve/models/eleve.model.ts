import PrismaService from "../../../service/prisma_service";

class EleveModel extends PrismaService {
    constructor() {
        super("eleve");
    }
}

export default EleveModel;