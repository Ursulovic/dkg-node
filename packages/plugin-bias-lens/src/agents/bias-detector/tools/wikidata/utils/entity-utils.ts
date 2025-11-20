import type { EntityResolution } from "../types";

export async function resolveEntity(
  entityName: string,
): Promise<EntityResolution | null> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    language: "en",
    type: "item",
    search: entityName,
    limit: "1",
  });

  try {
    const response = await fetch(
      `https://www.wikidata.org/w/api.php?${params}`,
    );
    const data: {
      search?: { id: string; label: string; description?: string }[];
    } = await response.json();

    if (data.search && data.search[0]) {
      return {
        entityId: data.search[0].id,
        label: data.search[0].label,
        description: data.search[0].description,
      };
    }

    return null;
  } catch {
    return null;
  }
}
