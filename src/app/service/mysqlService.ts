/* eslint-disable @typescript-eslint/no-explicit-any */
// src/database/MySQLService.ts
import mysql, { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

class MySQLService {
  private pool: Pool;
  private tableName: string;

  /**
   * Constructeur pour initialiser le service avec une table spécifique.
   * @param tableName Nom de la table MySQL.
   */
  constructor(tableName: string) {
    this.tableName = tableName;

    this.pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "erp_maker",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  /**
   * Crée une nouvelle entrée dans la table spécifiée.
   * @param data Données à insérer dans la table.
   * @returns L'objet créé (avec l'id inséré si présent).
   */
  public async create<T extends Record<string, any>>(data: T): Promise<T> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");

    const sql = `
      INSERT INTO \`${this.tableName}\` (${columns
        .map((col) => `\`${col}\``)
        .join(", ")})
      VALUES (${placeholders})
    `;

    const values = columns.map((col) => data[col]);

    const [result] = await this.pool.execute<ResultSetHeader>(sql, values);

    // On renvoie l'objet avec l'id inséré si la table a une PK auto-incrémentée "id"
    return {
      id: result.insertId,
      ...data,
    } as T;
  }

  /**
   * Récupère une entrée de la table spécifiée par son ID.
   * @param id ID de l'entrée à rechercher.
   * @returns L'objet trouvé ou null.
   */
  public async findUnique<T>(id: number): Promise<T | null> {
    const sql = `
      SELECT *
      FROM \`${this.tableName}\`
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [id]);

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as T;
  }

  /**
   * Récupère toutes les entrées de la table spécifiée.
   * @returns Un tableau d'objets.
   */
  public async findMany<T>(): Promise<T[]> {
    const sql = `
      SELECT *
      FROM \`${this.tableName}\`
    `;

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql);

    return rows as T[];
  }

  /**
   * Met à jour une entrée de la table spécifiée par son ID.
   * @param id ID de l'entrée à mettre à jour.
   * @param data Données à mettre à jour.
   * @returns L'objet mis à jour.
   */
  public async update<T extends Record<string, any>>(
    id: number,
    data: Partial<T>
  ): Promise<T | null> {
    const columns = Object.keys(data);
    if (columns.length === 0) {
      throw new Error("Aucune donnée fournie pour la mise à jour.");
    }

    const setClause = columns.map((col) => `\`${col}\` = ?`).join(", ");
    const values: any[] = columns.map((col) => data[col]);
    values.push(id); // pour le WHERE id = ?

    const sql = `
      UPDATE \`${this.tableName}\`
      SET ${setClause}
      WHERE id = ?
    `;

    await this.pool.execute<ResultSetHeader>(sql, values);

    // On relit la ligne mise à jour pour la retourner
    return this.findUnique<T>(id);
  }

  /**
   * Supprime une entrée de la table spécifiée par son ID.
   * @param id ID de l'entrée à supprimer.
   * @returns true si une ligne a été supprimée, sinon false.
   */
  public async delete(id: number): Promise<boolean> {
    const sql = `
      DELETE FROM \`${this.tableName}\`
      WHERE id = ?
    `;

    const [result] = await this.pool.execute<ResultSetHeader>(sql, [id]);

    return result.affectedRows > 0;
  }

  /**
   * Ferme proprement le pool de connexion MySQL.
   */
  public async disconnect(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Récupère des données à partir des conditions fournies.
   * @param where Conditions de recherche (clé/valeur).
   * @returns Un tableau d'objets.
   */
  public async findByCondition<T extends Record<string, any>>(
    where: Partial<T>
  ): Promise<T[]> {
    const keys = Object.keys(where);

    let sql = `
      SELECT *
      FROM \`${this.tableName}\`
    `;

    const values: any[] = [];

    if (keys.length > 0) {
      const conditions = keys.map((key) => {
        values.push(where[key]);
        return `\`${key}\` = ?`;
      });

      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, values);

    return rows as T[];
  }
}

export default MySQLService;
