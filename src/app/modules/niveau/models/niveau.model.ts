import PrismaService from "../../../service/prisma_service";

class NiveauModel extends PrismaService {
    constructor() {
        super("niveauScolaire");
    }
}

export default NiveauModel;