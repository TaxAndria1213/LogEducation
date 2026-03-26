import PrismaService from "../../../service/prisma_service";

class OperationFinanciereModel extends PrismaService {
  constructor() {
    super("operationFinanciere", {
      operationFinanciere: ["etablissement", "facture", "paiement", "createur"],
    });
  }
}

export default OperationFinanciereModel;
