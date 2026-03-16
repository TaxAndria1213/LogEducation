import PrismaService from "../../../service/prisma_service";

class EnseignantModel extends PrismaService {
    constructor() {
        super("enseignant");
    }
}

export default EnseignantModel;
