import PrismaService from "../../../service/prisma_service";

class EmploiDuTempsModel extends PrismaService {
    constructor() {
        super("emploiDuTemps");
    }
}

export default EmploiDuTempsModel;
