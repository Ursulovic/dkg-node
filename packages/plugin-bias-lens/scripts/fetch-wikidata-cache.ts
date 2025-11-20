import "dotenv/config";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

interface WikidataProperty {
  id: string;
  label: string;
  description?: string;
  aliases: string[];
  datatype: string;
}

interface PropertyConstraint {
  propertyId: string;
  constraintType: string;
  constraintTypeLabel: string;
  subjectTypes?: string[];
  valueTypes?: string[];
  formatPattern?: string;
}

interface EntityClass {
  id: string;
  label: string;
  description?: string;
  instanceCount: number;
}

interface Qualifier {
  id: string;
  label: string;
  description?: string;
  usageCount: number;
}

interface Country {
  id: string;
  label: string;
  isoCode?: string;
  population?: number;
  capital?: string;
  capitalLabel?: string;
}

interface Unit {
  id: string;
  label: string;
  description?: string;
  symbol?: string;
}

async function sparqlQuery(query: string): Promise<unknown> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "plugin-bias-lens/1.0 (https://github.com/origintrail/dkg-node)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `SPARQL query failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

function extractId(uri: string): string {
  return uri.split("/").pop() || "";
}

async function fetchAllProperties(): Promise<WikidataProperty[]> {
  console.log("Fetching all properties...");

  const query = `
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX schema: <http://schema.org/>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT ?p ?pLabel ?description ?datatype
           (GROUP_CONCAT(DISTINCT ?alias; separator="|") as ?aliases)
    WHERE {
      ?p wikibase:propertyType ?datatype .
      OPTIONAL { ?p skos:altLabel ?alias FILTER (LANG(?alias) = "en") }
      OPTIONAL { ?p schema:description ?description FILTER (LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?p ?pLabel ?description ?datatype
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any) => ({
    id: extractId(binding.p.value),
    label: binding.pLabel.value,
    description: binding.description?.value,
    aliases: binding.aliases?.value
      ? binding.aliases.value.split("|").filter(Boolean)
      : [],
    datatype: extractId(binding.datatype.value),
  }));
}

async function fetchPropertyConstraints(): Promise<PropertyConstraint[]> {
  console.log("Fetching property constraints...");

  const query = `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX p: <http://www.wikidata.org/prop/>
    PREFIX ps: <http://www.wikidata.org/prop/statement/>
    PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
    PREFIX wd: <http://www.wikidata.org/entity/>

    SELECT DISTINCT ?property ?constraintType ?constraintTypeLabel
           (GROUP_CONCAT(DISTINCT ?subjectType; separator="|") as ?subjectTypes)
           (GROUP_CONCAT(DISTINCT ?valueType; separator="|") as ?valueTypes)
           ?formatPattern
    WHERE {
      ?property wdt:P2302 ?constraintType.

      OPTIONAL {
        ?property p:P2302 [
          ps:P2302 wd:Q21503250;
          pq:P2308 ?subjectType
        ].
      }

      OPTIONAL {
        ?property p:P2302 [
          ps:P2302 wd:Q21510865;
          pq:P2308 ?valueType
        ].
      }

      OPTIONAL {
        ?property p:P2302 [
          ps:P2302 wd:Q21502404;
          pq:P1793 ?formatPattern
        ].
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?property ?constraintType ?constraintTypeLabel ?formatPattern
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any) => ({
    propertyId: extractId(binding.property.value),
    constraintType: extractId(binding.constraintType.value),
    constraintTypeLabel: binding.constraintTypeLabel.value,
    subjectTypes: binding.subjectTypes?.value
      ?.split("|")
      .map(extractId)
      .filter(Boolean),
    valueTypes: binding.valueTypes?.value
      ?.split("|")
      .map(extractId)
      .filter(Boolean),
    formatPattern: binding.formatPattern?.value,
  }));
}

async function fetchEntityClasses(): Promise<EntityClass[]> {
  console.log("Fetching common entity classes...");

  const commonClasses = [
    "Q5",
    "Q515",
    "Q6256",
    "Q4830453",
    "Q3918",
    "Q11173",
    "Q16521",
    "Q523",
    "Q3918",
    "Q891723",
    "Q3024240",
    "Q95074",
    "Q15632617",
    "Q7187",
    "Q8502",
    "Q12136",
    "Q4167410",
    "Q27",
    "Q43229",
    "Q11424",
  ];

  const query = `
    SELECT ?class ?classLabel ?description
    WHERE {
      VALUES ?class { ${commonClasses.map((id) => `wd:${id}`).join(" ")} }
      OPTIONAL { ?class schema:description ?description FILTER (LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any, index: number) => ({
    id: extractId(binding.class.value),
    label: binding.classLabel.value,
    description: binding.description?.value,
    instanceCount: 1000000 - index * 10000,
  }));
}

async function fetchCommonQualifiers(): Promise<Qualifier[]> {
  console.log("Fetching common qualifiers...");

  const commonQualifiers = [
    "P585",
    "P580",
    "P582",
    "P1319",
    "P1326",
    "P518",
    "P642",
    "P1706",
    "P3831",
    "P1365",
    "P1366",
    "P1545",
    "P2241",
    "P7452",
    "P5102",
    "P1810",
    "P805",
    "P1013",
    "P518",
    "P1001",
  ];

  const query = `
    SELECT ?qualifier ?qualifierLabel ?description
    WHERE {
      VALUES ?qualifier { ${commonQualifiers.map((id) => `wd:${id}`).join(" ")} }
      OPTIONAL { ?qualifier schema:description ?description FILTER (LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any, index: number) => ({
    id: extractId(binding.qualifier.value),
    label: binding.qualifierLabel.value,
    description: binding.description?.value,
    usageCount: 1000000 - index * 10000,
  }));
}

async function fetchCountries(): Promise<Country[]> {
  console.log("Fetching all countries...");

  const query = `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX wd: <http://www.wikidata.org/entity/>

    SELECT ?country ?countryLabel ?iso ?population ?capital ?capitalLabel
    WHERE {
      ?country wdt:P31 wd:Q6256.
      OPTIONAL { ?country wdt:P297 ?iso. }
      OPTIONAL { ?country wdt:P1082 ?population. }
      OPTIONAL { ?country wdt:P36 ?capital. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any) => ({
    id: extractId(binding.country.value),
    label: binding.countryLabel.value,
    isoCode: binding.iso?.value,
    population: binding.population
      ? parseInt(binding.population.value, 10)
      : undefined,
    capital: binding.capital ? extractId(binding.capital.value) : undefined,
    capitalLabel: binding.capitalLabel?.value,
  }));
}

async function fetchCommonUnits(): Promise<Unit[]> {
  console.log("Fetching common units of measurement...");

  const query = `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX wd: <http://www.wikidata.org/entity/>

    SELECT DISTINCT ?unit ?unitLabel ?description ?symbol
    WHERE {
      VALUES ?unitType { wd:Q47574 wd:Q208571 wd:Q3647172 }
      ?unit wdt:P31 ?unitType.
      OPTIONAL { ?unit wdt:P5061 ?symbol. }
      OPTIONAL { ?unit schema:description ?description FILTER (LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 500
  `;

  const data: any = await sparqlQuery(query);

  return data.results.bindings.map((binding: any) => ({
    id: extractId(binding.unit.value),
    label: binding.unitLabel.value,
    description: binding.description?.value,
    symbol: binding.symbol?.value,
  }));
}

function convertToDocuments(data: any[], type: string): Document[] {
  switch (type) {
    case "property": {
      return (data as WikidataProperty[]).map(
        (prop) =>
          new Document({
            pageContent: `${prop.label}${prop.description ? `: ${prop.description}` : ""}${
              prop.aliases.length > 0
                ? `. Also known as: ${prop.aliases.join(", ")}`
                : ""
            }`,
            metadata: {
              id: prop.id,
              type: "property",
              label: prop.label,
              description: prop.description,
              aliases: prop.aliases,
              datatype: prop.datatype,
            },
          }),
      );
    }
    case "constraint": {
      return (data as PropertyConstraint[]).map(
        (constraint) =>
          new Document({
            pageContent: `Property ${constraint.propertyId} has constraint: ${constraint.constraintTypeLabel}${
              constraint.subjectTypes
                ? `. Valid for entity types: ${constraint.subjectTypes.join(", ")}`
                : ""
            }${
              constraint.valueTypes
                ? `. Valid value types: ${constraint.valueTypes.join(", ")}`
                : ""
            }`,
            metadata: {
              type: "constraint",
              propertyId: constraint.propertyId,
              constraintType: constraint.constraintType,
              constraintTypeLabel: constraint.constraintTypeLabel,
              subjectTypes: constraint.subjectTypes,
              valueTypes: constraint.valueTypes,
              formatPattern: constraint.formatPattern,
            },
          }),
      );
    }
    case "entity-type": {
      return (data as EntityClass[]).map(
        (entityClass) =>
          new Document({
            pageContent: `${entityClass.label}${entityClass.description ? `: ${entityClass.description}` : ""}`,
            metadata: {
              id: entityClass.id,
              type: "entity-type",
              label: entityClass.label,
              description: entityClass.description,
              instanceCount: entityClass.instanceCount,
            },
          }),
      );
    }
    case "qualifier": {
      return (data as Qualifier[]).map(
        (qualifier) =>
          new Document({
            pageContent: `${qualifier.label}${qualifier.description ? `: ${qualifier.description}` : ""}`,
            metadata: {
              id: qualifier.id,
              type: "qualifier",
              label: qualifier.label,
              description: qualifier.description,
              usageCount: qualifier.usageCount,
            },
          }),
      );
    }
    case "country": {
      return (data as Country[]).map(
        (country) =>
          new Document({
            pageContent: `${country.label}${country.isoCode ? ` (${country.isoCode})` : ""}${
              country.population ? `. Population: ${country.population}` : ""
            }${country.capitalLabel ? `. Capital: ${country.capitalLabel}` : ""}`,
            metadata: {
              id: country.id,
              type: "country",
              label: country.label,
              isoCode: country.isoCode,
              population: country.population,
              capital: country.capital,
              capitalLabel: country.capitalLabel,
            },
          }),
      );
    }
    case "unit": {
      return (data as Unit[]).map(
        (unit) =>
          new Document({
            pageContent: `${unit.label}${unit.symbol ? ` (${unit.symbol})` : ""}${
              unit.description ? `: ${unit.description}` : ""
            }`,
            metadata: {
              id: unit.id,
              type: "unit",
              label: unit.label,
              description: unit.description,
              symbol: unit.symbol,
            },
          }),
      );
    }
    default:
      return [];
  }
}

async function main() {
  try {
    const outputDir = join(
      process.cwd(),
      "src/agents/bias-detector/tools/wikidata",
    );
    mkdirSync(outputDir, { recursive: true });

    console.log("\n=== Fetching Wikidata ===");
    const properties = await fetchAllProperties();
    const constraints = await fetchPropertyConstraints();
    const entityClasses = await fetchEntityClasses();
    const qualifiers = await fetchCommonQualifiers();
    const countries = await fetchCountries();
    const units = await fetchCommonUnits();

    console.log("\n=== Converting to Documents ===");
    const documents: Document[] = [
      ...convertToDocuments(properties, "property"),
      ...convertToDocuments(constraints, "constraint"),
      ...convertToDocuments(entityClasses, "entity-type"),
      ...convertToDocuments(qualifiers, "qualifier"),
      ...convertToDocuments(countries, "country"),
      ...convertToDocuments(units, "unit"),
    ];

    console.log(`\n✓ Created ${documents.length} documents`);
    console.log(`  - Properties: ${properties.length}`);
    console.log(`  - Constraints: ${constraints.length}`);
    console.log(`  - Entity Types: ${entityClasses.length}`);
    console.log(`  - Qualifiers: ${qualifiers.length}`);
    console.log(`  - Countries: ${countries.length}`);
    console.log(`  - Units: ${units.length}`);

    console.log("\n=== Creating Vector Index ===");
    console.log("Embedding documents (this may take a few minutes)...");

    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
    });

    const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

    const indexPath = join(outputDir, "wikidata-index");
    await vectorStore.save(indexPath);

    console.log(`\n✓ Vector index saved to ${indexPath}`);
    console.log("\n✓ Wikidata cache generated successfully!");
    console.log(
      "\nℹ️  The old JSON files in src/data/wikidata/ can now be deleted.",
    );
  } catch (error) {
    console.error("Error fetching Wikidata cache:", error);
    process.exit(1);
  }
}

main();
