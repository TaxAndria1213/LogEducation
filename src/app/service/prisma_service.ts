/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PrismaClient } from "@prisma/client";

type OrderBy = Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;

type FindManyOptions = {
  where?: object;
  orderBy?: OrderBy;
  select?: object;
  include?: object;

  // ✅ Nouveau: gestion includes "simples" (strings) et "riches" (spec Prisma)
  includeAll?: boolean; // inclure toutes les relations connues du modèle (via relationsMap)
  includes?: string[]; // ex: ["user", "items", "items.product"]
  includeSpec?: object; // ex: { user: { select: {...} }, items: { include: { product: true } } }

  // Pagination offset
  page?: number; // 1..n
  take?: number; // size
  skip?: number;

  // Cursor pagination
  cursor?: object;
  cursorField?: string;
  skipCursor?: boolean;

  // Sécurité/Perf
  maxTake?: number;
};

type PaginatedResult<T> = {
  data: T[];
  meta: {
    take: number;
    skip?: number;
    page?: number;
    total?: number;
    hasNextPage: boolean;
    nextCursor?: any;
  };
};

// ✅ relationsMap: whitelist des relations par modèle (parents/enfants)
type RelationsMap = Partial<Record<string, string[]>>;

class PrismaService {
  private prisma: PrismaClient;
  private modelName: keyof PrismaClient;
  private relationsMap: RelationsMap;

  constructor(modelName: keyof PrismaClient, relationsMap: RelationsMap = {}) {
    this.prisma = new PrismaClient();

    if (!this.prisma[modelName] || typeof this.prisma[modelName] !== "object") {
      throw new Error(`Le modèle "${String(modelName)}" n'existe pas dans PrismaClient.`);
    }

    this.modelName = modelName;
    this.relationsMap = relationsMap;
  }

  public async create<T>(data: T): Promise<T> {
    // @ts-expect-error
    return this.prisma[this.modelName].create({ data });
  }

  public async findUnique<T>(id: string | number, options: Pick<FindManyOptions, "include" | "includeAll" | "includes" | "includeSpec" | "select"> = {}): Promise<T> {
    const include = this.buildInclude(options);
    // @ts-expect-error
    return this.prisma[this.modelName].findUnique({
      where: { id },
      select: options.select,
      include,
    });
  }

  public async findMany<T>(options: Pick<FindManyOptions, "where" | "orderBy" | "select" | "include" | "includeAll" | "includes" | "includeSpec"> = {}): Promise<T[]> {
    const include = this.buildInclude(options);
    // @ts-expect-error
    return this.prisma[this.modelName].findMany({
      where: options.where,
      orderBy: options.orderBy,
      select: options.select,
      include,
    });
  }

  public async update<T>(id: string | number, data: T): Promise<T> {
    // @ts-expect-error
    return this.prisma[this.modelName].update({ where: { id }, data });
  }

  public async delete<T>(id: string | number): Promise<T> {
    // @ts-expect-error
    return this.prisma[this.modelName].delete({ where: { id } });
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  public async findByCondition<T>(where: object, options: Pick<FindManyOptions, "orderBy" | "select" | "include" | "includeAll" | "includes" | "includeSpec"> = {}): Promise<T[]> {
    const include = this.buildInclude(options);
    // @ts-expect-error
    return this.prisma[this.modelName].findMany({
      where,
      orderBy: options.orderBy,
      select: options.select,
      include,
    }) as Promise<T[]>;
  }

  public async findLast<T>(options: Pick<FindManyOptions, "select" | "include" | "includeAll" | "includes" | "includeSpec" | "where"> = {}): Promise<T> {
    const include = this.buildInclude(options);
    // @ts-expect-error
    return this.prisma[this.modelName].findFirst({
      orderBy: { created_at: "desc" },
      select: options.select,
      where: options.where,
      include,
    });
  }

  // =========================
  //        PAGINATION
  // =========================

  public async findManyPaginated<T>(options: FindManyOptions = {}): Promise<PaginatedResult<T>> {
    const {
      where,
      orderBy,
      select,

      page,
      take,
      skip,

      cursor,
      cursorField = "id",
      skipCursor = true,

      maxTake = 100,
    } = options;

    const safeTake = this.clampTake(take ?? 20, maxTake);

    // ✅ include construit (include + includes[] + includeSpec + includeAll)
    const include = this.buildInclude(options);

    // ---- CURSOR PAGINATION
    if (cursor) {
      const queryTake = safeTake + 1;

      // @ts-expect-error
      const rows: T[] = await this.prisma[this.modelName].findMany({
        where,
        orderBy,
        select,
        include,
        cursor,
        skip: skipCursor ? 1 : 0,
        take: queryTake,
      });

      const hasNextPage = rows.length > safeTake;
      const data = hasNextPage ? rows.slice(0, safeTake) : rows;

      const last = data[data.length - 1] as any;
      const nextCursor =
        hasNextPage && last && last[cursorField] !== undefined
          ? { [cursorField]: last[cursorField] }
          : undefined;

      return {
        data,
        meta: {
          take: safeTake,
          hasNextPage,
          nextCursor,
        },
      };
    }

    // ---- OFFSET PAGINATION
    const computedSkip =
      typeof skip === "number"
        ? Math.max(0, skip)
        : typeof page === "number"
          ? Math.max(0, (Math.max(1, page) - 1) * safeTake)
          : 0;

    // @ts-expect-error
    const total: number = await this.prisma[this.modelName].count({ where });

    // @ts-expect-error
    const data: T[] = await this.prisma[this.modelName].findMany({
      where,
      orderBy,
      select,
      include,
      skip: computedSkip,
      take: safeTake,
    });

    const hasNextPage = computedSkip + data.length < total;

    return {
      data,
      meta: {
        take: safeTake,
        skip: computedSkip,
        page: typeof page === "number" ? Math.max(1, page) : undefined,
        total,
        hasNextPage,
      },
    };
  }

  // =========================
  //      INCLUDE HELPERS
  // =========================

  /**
   * Construit un include Prisma:
   * - include (objet Prisma natif) + includeSpec
   * - includes: ["user","items","items.product"] => { user:true, items:{ include:{ product:true } } }
   * - includeAll: inclut toutes les relations connues du modèle via relationsMap
   *
   * Règles:
   * - Si select est fourni, Prisma interdit parfois include sur certains champs => à toi de gérer au cas par cas.
   * - Si rien à inclure => undefined (Prisma ignore)
   */
  private buildInclude(options: Pick<FindManyOptions, "include" | "includes" | "includeSpec" | "includeAll">): any {
    const base: any = {};

    // 1) includeAll => on prend la whitelist des relations du modèle
    if (options.includeAll) {
      const modelKey = String(this.modelName);
      const rels = this.relationsMap[modelKey] ?? [];
      for (const r of rels) {
        this.setNestedInclude(base, r, true);
      }
    }

    // 2) includes[] => chemins nested
    if (Array.isArray(options.includes)) {
      for (const path of options.includes) {
        if (typeof path === "string" && path.trim()) {
          this.setNestedInclude(base, path.trim(), true);
        }
      }
    }

    // 3) include (objet Prisma) => merge
    if (options.include && typeof options.include === "object") {
      this.deepMerge(base, options.include);
    }

    // 4) includeSpec (objet Prisma riche) => merge (écrase/complète)
    if (options.includeSpec && typeof options.includeSpec === "object") {
      this.deepMerge(base, options.includeSpec);
    }

    return Object.keys(base).length ? base : undefined;
  }

  /**
   * Transforme "items.product" en include imbriqué:
   * base.items = { include: { product: true } }
   */
  private setNestedInclude(target: any, path: string, leafValue: any): void {
    const parts = path.split(".").filter(Boolean);
    if (!parts.length) return;

    let node = target;

    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      const isLeaf = i === parts.length - 1;

      // Si leaf => true ou spec
      if (isLeaf) {
        if (node[key] === undefined) {
          node[key] = leafValue;
        } else if (node[key] && typeof node[key] === "object" && leafValue && typeof leafValue === "object") {
          this.deepMerge(node[key], leafValue);
        } else {
          node[key] = node[key] ?? leafValue;
        }
        return;
      }

      // Intermédiaire => doit être un objet avec include
      if (node[key] === true) {
        node[key] = { include: {} };
      } else if (node[key] === undefined) {
        node[key] = { include: {} };
      } else if (typeof node[key] === "object" && node[key] !== null) {
        if (!("include" in node[key])) node[key].include = {};
      } else {
        node[key] = { include: {} };
      }

      node = node[key].include;
    }
  }

  /**
   * Deep merge simple (objets uniquement).
   * Les scalaires remplacent, les objets se merge.
   */
  private deepMerge(target: any, source: any): any {
    if (!source || typeof source !== "object") return target;
    for (const key of Object.keys(source)) {
      const sVal = source[key];
      const tVal = target[key];

      if (sVal && typeof sVal === "object" && !Array.isArray(sVal)) {
        if (!tVal || typeof tVal !== "object" || Array.isArray(tVal)) {
          target[key] = {};
        }
        this.deepMerge(target[key], sVal);
      } else {
        target[key] = sVal;
      }
    }
    return target;
  }

  private clampTake(take: number, maxTake: number): number {
    const t = Number.isFinite(take) ? Math.floor(take) : 20;
    return Math.max(1, Math.min(t, maxTake));
  }
}

export default PrismaService;
