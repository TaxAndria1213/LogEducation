import PrismaService from "src/app/service/prisma_service"; //à supprimer au copie
// import PrismaService from "../../../service/prisma_service"; // à utiliser au copie

class EtablissementModel extends PrismaService {
    constructor() {
        super("etablissement"); // à changer par le nom de model correspondant
    }
}

export default EtablissementModel;