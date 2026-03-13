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

/**
 * Génère un mot de passe aléatoire de 12 caractères
 * Contient des lettres majuscules, minuscules, chiffres et caractères spéciaux
 */
export function generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';

    // S'assurer qu'il y a au moins un caractère de chaque type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Compléter le reste du mot de passe
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mélanger les caractères pour plus de sécurité
    return password.split('').sort(() => Math.random() - 0.5).join('');
}