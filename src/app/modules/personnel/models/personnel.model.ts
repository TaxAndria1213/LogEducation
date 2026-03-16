import PrismaService from "../../../service/prisma_service";

class PersonnelModel extends PrismaService {
    constructor() {
        super("personnel");
    }
}

export default PersonnelModel;
