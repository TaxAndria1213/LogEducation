/* eslint-disable @typescript-eslint/no-explicit-any */
import { ParsedQs } from "qs";
import PrismaService from "../../service/prisma_service";
import { parseBool, parseJSON, parseNumber, parseStringArray } from "./query";

export async function getAllPaginated(query: ParsedQs, model: PrismaService) {
    const page = parseNumber(query.page, 1) ?? 1;
    const take = parseNumber(query.take, 10) ?? 10;

    const where = parseJSON<object>(query.where, {});
    const orderBy = parseJSON<any>(query.orderBy, undefined);

    const includeAll = parseBool(query.includeAll, false);
    const includes = parseStringArray(query.includes);
    const includeSpec = parseJSON<object>(query.includeSpec, null);
    const select = parseJSON<object>(query.select, null);


    const result = await model.findManyPaginated({
        page,
        take,
        where: Object.keys(where ?? {}).length ? where : undefined,
        orderBy,
        includeAll,
        includes,
        includeSpec,
        select,
        maxTake: 100,
    });

    return result;
}