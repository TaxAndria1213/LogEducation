import PrismaService from "../../../service/prisma_service";

class CoursModel extends PrismaService {
    constructor() {
        super("cours");
    }
}

export default CoursModel;
