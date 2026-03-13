/* eslint-disable @typescript-eslint/no-explicit-any */
import { Http } from "./Http";

class Service {
  public url: string;
  constructor(url: string) {
    this.url = url;
  }

  setUrl(url: string, params?: Record<string, string | number>, filterPrefix = "filter") {
    if (params) {
      const queryString = Object.entries(params).map(([key, value]) => `${filterPrefix}[${key}]=${encodeURIComponent(value)}`).join("&");
      this.url = `${url}?${queryString}`;
    } else { this.url = url; } return this;
  }
  async getAll(params?: string | number | Record<string, string | number | Date | boolean>) {
    const mergedParams = typeof params === 'object' ? { ...params } : {};
    return await Http.get(["/api", this.url].join("/"), mergedParams);
  }
  async get(id: string | number) {
    return await Http.get(["/api", this.url, id].join("/"), {});
  }
  async create(params: any) {
    return await Http.post(["/api", this.url].join("/"), params);
  }
  async update(id: number | string, params: any) {
    return await Http.put(["/api", this.url, id].join("/"), params);
  }
  async delete(id: string | number) {
    return await Http.delete(["/api", this.url, id].join("/"));
  }

  async getLast(params?: any) { return await Http.get(["/api", this.url, "last"].join("/"), params); }
} export default Service;