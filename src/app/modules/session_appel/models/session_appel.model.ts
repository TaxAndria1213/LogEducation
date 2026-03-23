import PrismaService from "../../../service/prisma_service";

class SessionAppelModel extends PrismaService {
  constructor() {
    super("sessionAppel", {
      sessionAppel: ["classe", "emploi", "creneau", "prisPar", "presences", "presences.eleve"],
    });
  }
}

export default SessionAppelModel;
