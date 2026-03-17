import PrismaService from "../../../service/prisma_service";

class BulletinModel extends PrismaService {
    constructor() {
        super("bulletin");
    }
}

export default BulletinModel;
