import { Utilisateur } from "@prisma/client";
import PrismaService from "../../../service/prisma_service";

class UserModel extends PrismaService {
    constructor() {
        super("utilisateur");
    }

    async findByEmail(email: string) {
        const res = await this.findByCondition({ email }, {
            include: { roles: { include: { role: true, } }, profil: true, etablissement: true },
        });
        return res[0] as Utilisateur;
    }
}

export default UserModel;