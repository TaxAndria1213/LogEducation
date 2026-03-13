import PrismaService from "../../../service/prisma_service";

class ClasseModel extends PrismaService {
    constructor() {
        super("classe");
    }
}

export default ClasseModel;