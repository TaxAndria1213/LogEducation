import { appendFile, readFile, writeFile } from "fs/promises";
import { glob } from "glob";

const start = async () => {
  const schemaFile = "prisma/schema.prisma";
  const connectFile = "prisma/db.prisma.init";
  const initModels = "prisma/schema.init";
  const models = await glob(["out/*.model", "src/app/modules/**/domain/models/*.model"]);
  const files = [connectFile, initModels, ...models];

  await writeFile(schemaFile, "");

  await Promise.all(
    files.map(async (path) => {
      const content = await readFile(path);
      return appendFile(schemaFile, content.toString());
    })
  );
};
start();
