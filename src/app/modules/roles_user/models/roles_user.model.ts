import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class EtablissementModel extends PrismaService {
    constructor() {
        super("utilisateurRole"); // à changer par le nom de model correspondant
    }
}

export default EtablissementModel;