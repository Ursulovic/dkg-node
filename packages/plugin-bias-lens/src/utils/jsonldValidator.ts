import jsonld from "jsonld";

export class JsonLdValidationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "JsonLdValidationError";
  }
}

export async function validateJsonLd(document: object): Promise<void> {
  try {
    await jsonld.expand(document);
  } catch (error) {
    throw new JsonLdValidationError(
      `Invalid JSON-LD: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

export async function validateBiasReport(asset: {
  public: object;
  private: object;
}): Promise<void> {
  await validateJsonLd(asset.public);
  await validateJsonLd(asset.private);
}

export async function expandJsonLd(document: object): Promise<object[]> {
  return jsonld.expand(document);
}

export async function compactJsonLd(
  document: object,
  context: jsonld.ContextDefinition
): Promise<object> {
  return jsonld.compact(document, context);
}

export async function toNQuads(document: object): Promise<string> {
  return jsonld.toRDF(document, { format: "application/n-quads" }) as Promise<string>;
}
