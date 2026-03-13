import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class RolesModel extends PrismaService {
    constructor() {
        super("role"); // à changer par le nom de model correspondant
    }
}

export default RolesModel;