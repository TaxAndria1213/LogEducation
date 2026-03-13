import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class AnneeScolaireModel extends PrismaService {
    constructor() {
        super("anneeScolaire"); // à changer par le nom de model correspondant
    }
}

export default AnneeScolaireModel;