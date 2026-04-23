import { Utilisateur } from "@prisma/client";
import PrismaService from "../../../service/prisma_service";

class UserModel extends PrismaService {
    private readonly identityInclude = {
        include: {
            roles: {
                include: {
                    role: true,
                },
            },
            profil: true,
            etablissement: true,
        },
    };

    constructor() {
        super("utilisateur");
    }

    async findByEmail(email: string) {
        const res = await this.findByCondition({ email }, this.identityInclude);
        return res[0] as Utilisateur;
    }

    async findManyByEmail(email: string) {
        return this.findByCondition<Utilisateur>({ email }, this.identityInclude);
    }

    async findById(id: string) {
        return this.findUnique<Utilisateur>(id, this.identityInclude);
    }
}

export default UserModel;
