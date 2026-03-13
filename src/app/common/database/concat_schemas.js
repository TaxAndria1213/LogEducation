import { appendFile, readFile, writeFile } from "fs/promises";
import { glob } from "glob";

const start = async () => {
  const schemaFile = "app/common/databases/schema.prisma";
  const connectFile = "app/common/databases/db.prisma";
  const models = await glob("app/modules/**/domain/models/*.model");
  const files = [connectFile, ...models];

  await writeFile(schemaFile, "");

  await Promise.all(
    files.map(async (path) => {
      const content = await readFile(path);
      return appendFile(schemaFile, content.toString());
    })
  );
};
start();
