import PrismaService from "../../../service/prisma_service";

class NoteModel extends PrismaService {
    constructor() {
        super("note");
    }
}

export default NoteModel;
