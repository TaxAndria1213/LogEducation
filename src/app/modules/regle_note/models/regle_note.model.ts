import PrismaService from "../../../service/prisma_service";

class RegleNoteModel extends PrismaService {
    constructor() {
        super("regleNote");
    }
}

export default RegleNoteModel;
