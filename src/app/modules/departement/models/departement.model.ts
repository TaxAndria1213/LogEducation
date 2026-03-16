import PrismaService from "../../../service/prisma_service";

class DepartementModel extends PrismaService {
    constructor() {
        super("departement");
    }
}

export default DepartementModel;
