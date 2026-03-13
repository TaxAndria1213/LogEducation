import PrismaService from "../../../service/prisma_service";

class EtablissementModel extends PrismaService {
    constructor() {
        super("referenciel");
    }
}

export default EtablissementModel;