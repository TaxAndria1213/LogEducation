/* eslint-disable @typescript-eslint/no-explicit-any */
import MySQLService from "./mysqlService";

class SQLService {
    private sql: MySQLService;
    constructor(private modelName: string ) {
        this.sql = new MySQLService(this.modelName);
    }

    create(data: any) {
        return this.sql.create(data);
    }

    findUnique(id: number) {
        return this.sql.findUnique(id);
    }

    findMany() {
        return this.sql.findMany();
    }

    update(id: number, data: any) {
        return this.sql.update(id, data);
    }

    delete(id: number) {
        return this.sql.delete(id);
    }

    findByCondition(where: object) {
        return this.sql.findByCondition(where);
    }


}

export default SQLService;