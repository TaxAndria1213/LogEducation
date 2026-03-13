import PrismaService from "../../../service/prisma_service";

class EtablissementModel extends PrismaService {
    constructor() {
        super("etablissement");
    }
}

export default EtablissementModel;