import PrismaService from "../../../service/prisma_service";

class FormuleCantineModel extends PrismaService {
  constructor() {
    super("formuleCantine");
  }
}

export default FormuleCantineModel;
