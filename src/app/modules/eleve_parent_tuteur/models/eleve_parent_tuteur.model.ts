import PrismaService from "../../../service/prisma_service";

class EleveParentTuteurModel extends PrismaService {
    constructor() {
        super("eleveParentTuteur");
    }
}

export default EleveParentTuteurModel;
