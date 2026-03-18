import { Http } from "../app/api/Http";
import Service from "../app/api/Service";

class BulletinService extends Service {
    constructor() {
        super("bulletin");
    }

    async generate(id: string) {
        return await Http.post(["/api", this.url, id, "generer"].join("/"), {});
    }
}

export default BulletinService;
