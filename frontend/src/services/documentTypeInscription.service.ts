import { Http } from "../app/api/Http";
import Service from "../app/api/Service";

class DocumentTypeInscriptionService extends Service {
    constructor() {
        super("document-type-inscription");
    }

    async clone(id: string) {
        return Http.post(["/api", this.url, id, "clone"].join("/"), {});
    }
}

export default DocumentTypeInscriptionService;
