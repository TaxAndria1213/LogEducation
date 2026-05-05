import Service from "../app/api/Service";
import { Http } from "../app/api/Http";

class EleveService extends Service {
    constructor() {
        super("eleve");
    }

    async getDossier(id: string) {
        return await Http.get(["/api", this.url, id, "dossier"].join("/"), {});
    }
}

export default EleveService
