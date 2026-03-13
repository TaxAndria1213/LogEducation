import PrismaService from "../../../service/prisma_service";

class IdentifiantEleveModel extends PrismaService {
    constructor() {
        super("identifiantEleve");
    }
}

export default IdentifiantEleveModel;