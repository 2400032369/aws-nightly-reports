import { httpService } from "./http";
import { mockService } from "./mock";
import type { ApiService } from "./types";

export const USE_MOCK = (import.meta.env["VITE_USE_MOCK"] ?? "true") !== "false";
export const api: ApiService = USE_MOCK ? mockService : httpService;
export * from "./types";
