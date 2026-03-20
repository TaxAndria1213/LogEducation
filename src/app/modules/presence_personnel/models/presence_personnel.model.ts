import PrismaService from "../../../service/prisma_service";

class PresencePersonnelModel extends PrismaService {
  constructor() {
    super("presencePersonnel", {
      presencePersonnel: ["personnel", "personnel.utilisateur", "personnel.utilisateur.profil"],
    });
  }
}

export default PresencePersonnelModel;
