import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class SalleModel extends PrismaService {
    constructor() {
        super("salle"); // à changer par le nom de model correspondant
    }
}

export default SalleModel;