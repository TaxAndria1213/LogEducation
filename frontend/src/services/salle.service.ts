import Service from "../app/api/Service";

class SalleService extends Service{
    constructor() {
        super("salle");
    }
}

export default new SalleService();