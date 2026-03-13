import DatabaseModel from "../../app/modules/database/models/database";

describe("Database", () => {
    it("should create a database", () => {
        const database = new DatabaseModel();
        expect(database.create({})).toBe("This create a database");
    });
})