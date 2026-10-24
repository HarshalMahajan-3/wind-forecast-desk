
import type { AnalysisRequest, VintageReport, WindAnalysis } from "./analysis";

// Browser/Vite environment variables
const viteEnv = (
  import.meta as ImportMeta & {
    readonly env: Record<string, string | undefined>;
  }
).env;

const browserApiBaseUrl = (
  viteEnv["VITE_API_BASE_URL"] || "http://localhost:8000"
).replace(/\/$/, "");

// Server environment variables available inside Docker
const serverEnv = (
  globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }
).process?.env;

const internalApiBaseUrl = serverEnv?.["API_INTERNAL_BASE_URL"];

// Use Docker's internal address during SSR and localhost in the browser
const API_BASE_URL = (
  typeof window === "undefined"
    ? internalApiBaseUrl || browserApiBaseUrl
    : browserApiBaseUrl
).replace(/\/$/, "");

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wind API request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export function getAnalysis({
  data,
}: {
  data: AnalysisRequest;
}): Promise<WindAnalysis> {
  const params = new URLSearchParams({
    cutoffHour: String(data.cutoffHour),
    cutoffMinute: String(data.cutoffMinute),
  });

  return requestJson<WindAnalysis>(`/api/analysis?${params.toString()}`);
}

export function getVintages({
  data,
}: {
  data: AnalysisRequest & { targetTime: string };
}): Promise<VintageReport> {
  const params = new URLSearchParams({
    targetTime: data.targetTime,
    cutoffHour: String(data.cutoffHour),
    cutoffMinute: String(data.cutoffMinute),
  });

  return requestJson<VintageReport>(`/api/vintages?${params.toString()}`);
}
