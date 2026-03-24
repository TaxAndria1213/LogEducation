import PrismaService from "../../../service/prisma_service";

class CatalogueFraisModel extends PrismaService {
  constructor() {
    super("catalogueFrais", {
      catalogueFrais: ["etablissement", "niveau", "lignesFacture"],
    });
  }
}

export default CatalogueFraisModel;
