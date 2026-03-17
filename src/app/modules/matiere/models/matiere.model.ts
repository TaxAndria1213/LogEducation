import PrismaService from "../../../service/prisma_service";

class MatiereModel extends PrismaService {
    constructor() {
        super("matiere");
    }
}

export default MatiereModel;
