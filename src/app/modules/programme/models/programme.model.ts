import PrismaService from "../../../service/prisma_service";

class ProgrammeModel extends PrismaService {
    constructor() {
        super("programme");
    }
}

export default ProgrammeModel;
