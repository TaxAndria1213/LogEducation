import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class SiteModel extends PrismaService {
    constructor() {
        super("site"); // à changer par le nom de model correspondant
    }
}

export default SiteModel;