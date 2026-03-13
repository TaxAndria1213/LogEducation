/* eslint-disable @typescript-eslint/no-explicit-any */
import { type TableQuery } from "./types";

function truthy(v: any) {
  return v !== undefined && v !== null && v !== "";
}

/**
 * Convertit TableQuery -> params que ton Service.getAll va envoyer
 * (Http.get devra construire la query string).
 */
export function tableQueryToParams(q: TableQuery): Record<string, any> {
  const params: Record<string, any> = {};

  if (truthy(q.page)) params.page = q.page;
  if (truthy(q.take)) params.take = q.take;

  if (q.where && Object.keys(q.where).length) {
    params.where = JSON.stringify(q.where);
  }

  if (q.orderBy) {
    params.orderBy = JSON.stringify(q.orderBy);
  }

  if (truthy(q.includeAll)) params.includeAll = String(Boolean(q.includeAll));

  if (q.includes?.length) {
    // au choix: CSV ou JSON. Ici CSV simple.
    params.includes = q.includes.join(",");
  }

  if (q.includeSpec && Object.keys(q.includeSpec).length) {
    params.includeSpec = JSON.stringify(q.includeSpec);
  }

  if (q.select && Object.keys(q.select).length) {
    params.select = JSON.stringify(q.select);
  }

  return params;
}
