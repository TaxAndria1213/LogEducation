import PrismaService from "../../../service/prisma_service";

class InscriptionModel extends PrismaService {
    constructor() {
        super("inscription");
    }
}

export default InscriptionModel;