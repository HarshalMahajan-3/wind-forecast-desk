import { queryOptions } from "@tanstack/react-query";

import { getAnalysis, getVintages } from "./functions";

export function analysisQueryOptions(cutoffHour: number, cutoffMinute: number) {
  return queryOptions({
    queryKey: ["wind-analysis", cutoffHour, cutoffMinute],
    queryFn: () => getAnalysis({ data: { cutoffHour, cutoffMinute } }),
  });
}

export function vintagesQueryOptions(
  targetTime: string,
  cutoffHour: number,
  cutoffMinute: number,
) {
  return queryOptions({
    queryKey: ["wind-vintages", targetTime, cutoffHour, cutoffMinute],
    queryFn: () =>
      getVintages({ data: { targetTime, cutoffHour, cutoffMinute } }),
    enabled: true,
  });
}
