import { format } from "date-fns";

import { getCurrentUser } from "@/lib/auth/user";
import { logServerError } from "@/lib/errors";
import { exportToCsv, exportToJson, type CsvDataset } from "@/lib/export";
import { parseEpisodeFilter } from "@/lib/filters";
import { loadExportableEpisodes } from "@/server/analytics";

/**
 * Data export.
 *
 *   /api/export?format=json
 *   /api/export?format=csv&dataset=measurements
 *
 * Any episode filter from the history page can be appended to export a subset;
 * with no filter parameters the whole history is exported.
 */

const CSV_DATASETS: readonly CsvDataset[] = ["episodes", "measurements", "treatments"];

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Not signed in", { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedFormat = url.searchParams.get("format") ?? "json";
    const filter = parseEpisodeFilter(url.searchParams);
    const episodes = await loadExportableEpisodes(user.id, filter);
    const stamp = format(new Date(), "yyyy-MM-dd");

    if (requestedFormat === "csv") {
      const requestedDataset = url.searchParams.get("dataset") ?? "episodes";
      const dataset = CSV_DATASETS.includes(requestedDataset as CsvDataset)
        ? (requestedDataset as CsvDataset)
        : "episodes";

      return fileResponse(
        exportToCsv(episodes, dataset),
        "text/csv; charset=utf-8",
        `pain-${dataset}-${stamp}.csv`,
      );
    }

    if (requestedFormat !== "json") {
      return new Response("Unsupported format. Use format=json or format=csv.", {
        status: 400,
      });
    }

    return fileResponse(
      exportToJson(episodes),
      "application/json; charset=utf-8",
      `pain-export-${stamp}.json`,
    );
  } catch (error) {
    logServerError("GET /api/export", error);
    return new Response("The export could not be generated. Please try again.", {
      status: 500,
    });
  }
}

function fileResponse(
  body: string,
  contentType: string,
  filename: string,
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Health data must not be written to any shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
