import PrismaService from "../../../service/prisma_service";

class ProfileModel extends PrismaService {
    constructor() {
        super("profil");
    }
}

export default ProfileModel;