import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class PeriodeModel extends PrismaService {
    constructor() {
        super("periode"); // à changer par le nom de model correspondant
    }
}

export default PeriodeModel;