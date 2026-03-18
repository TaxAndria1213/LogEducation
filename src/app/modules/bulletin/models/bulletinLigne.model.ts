import PrismaService from "../../../service/prisma_service";

class BulletinLigneModel extends PrismaService {
    constructor() {
        super("bulletinLigne");
    }
}

export default BulletinLigneModel;
