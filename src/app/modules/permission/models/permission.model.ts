import PrismaService from "../../../service/prisma_service";

class PermissionModel extends PrismaService {
    constructor() {
        super("permission");
    }
}

export default PermissionModel;
