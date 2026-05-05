import PrismaService from "../../../service/prisma_service";

class DocumentTypeInscriptionModel extends PrismaService {
    constructor() {
        super("documentTypeInscription");
    }
}

export default DocumentTypeInscriptionModel;
