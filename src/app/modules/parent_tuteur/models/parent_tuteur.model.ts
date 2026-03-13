import PrismaService from "../../../service/prisma_service";

class ParentTuteurModel extends PrismaService {
    constructor() {
        super("parentTuteur");
    }
}

export default ParentTuteurModel;