import PrismaService from "../../../service/prisma_service";

class EvenementCalendrierModel extends PrismaService {
    constructor() {
        super("evenementCalendrier");
    }
}

export default EvenementCalendrierModel;
