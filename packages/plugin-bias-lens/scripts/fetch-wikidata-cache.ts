import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
      'User-Agent': 'plugin-bias-lens/1.0 (https://github.com/origintrail/dkg-node)',
    },
  });

  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function extractId(uri: string): string {
  return uri.split('/').pop() || '';
}

async function fetchAllProperties(): Promise<WikidataProperty[]> {
  console.log('Fetching all properties...');

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
    aliases: binding.aliases?.value ? binding.aliases.value.split('|').filter(Boolean) : [],
    datatype: extractId(binding.datatype.value),
  }));
}

async function fetchPropertyConstraints(): Promise<PropertyConstraint[]> {
  console.log('Fetching property constraints...');

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
    subjectTypes: binding.subjectTypes?.value?.split('|').map(extractId).filter(Boolean),
    valueTypes: binding.valueTypes?.value?.split('|').map(extractId).filter(Boolean),
    formatPattern: binding.formatPattern?.value,
  }));
}

async function fetchEntityClasses(): Promise<EntityClass[]> {
  console.log('Fetching common entity classes...');

  const commonClasses = [
    'Q5',
    'Q515',
    'Q6256',
    'Q4830453',
    'Q3918',
    'Q11173',
    'Q16521',
    'Q523',
    'Q3918',
    'Q891723',
    'Q3024240',
    'Q95074',
    'Q15632617',
    'Q7187',
    'Q8502',
    'Q12136',
    'Q4167410',
    'Q27',
    'Q43229',
    'Q11424',
  ];

  const query = `
    SELECT ?class ?classLabel ?description
    WHERE {
      VALUES ?class { ${commonClasses.map((id) => `wd:${id}`).join(' ')} }
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
  console.log('Fetching common qualifiers...');

  const commonQualifiers = [
    'P585',
    'P580',
    'P582',
    'P1319',
    'P1326',
    'P518',
    'P642',
    'P1706',
    'P3831',
    'P1365',
    'P1366',
    'P1545',
    'P2241',
    'P7452',
    'P5102',
    'P1810',
    'P805',
    'P1013',
    'P518',
    'P1001',
  ];

  const query = `
    SELECT ?qualifier ?qualifierLabel ?description
    WHERE {
      VALUES ?qualifier { ${commonQualifiers.map((id) => `wd:${id}`).join(' ')} }
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
  console.log('Fetching all countries...');

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
    population: binding.population ? parseInt(binding.population.value, 10) : undefined,
    capital: binding.capital ? extractId(binding.capital.value) : undefined,
    capitalLabel: binding.capitalLabel?.value,
  }));
}

async function fetchCommonUnits(): Promise<Unit[]> {
  console.log('Fetching common units of measurement...');

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

async function main() {
  try {
    const outputDir = join(process.cwd(), 'src/data/wikidata');
    mkdirSync(outputDir, { recursive: true });

    const properties = await fetchAllProperties();
    const constraints = await fetchPropertyConstraints();
    const entityClasses = await fetchEntityClasses();
    const qualifiers = await fetchCommonQualifiers();
    const countries = await fetchCountries();
    const units = await fetchCommonUnits();

    const files = [
      { name: 'properties.json', data: properties },
      { name: 'constraints.json', data: constraints },
      { name: 'entity-types.json', data: entityClasses },
      { name: 'qualifiers.json', data: qualifiers },
      { name: 'countries.json', data: countries },
      { name: 'units.json', data: units },
    ];

    console.log('\n=== Cache Statistics ===');
    for (const { name, data } of files) {
      const filePath = join(outputDir, name);
      const json = JSON.stringify(data, null, 2);
      writeFileSync(filePath, json);

      const sizeKB = (json.length / 1024).toFixed(2);
      const sizeMB = (json.length / 1024 / 1024).toFixed(2);
      console.log(
        `✓ ${name.padEnd(20)} - ${Array.isArray(data) ? data.length : 'N/A'} items - ${
          parseFloat(sizeMB) >= 1 ? `${sizeMB} MB` : `${sizeKB} KB`
        }`,
      );
    }

    const totalSize = files.reduce(
      (sum, { data }) => sum + JSON.stringify(data, null, 2).length,
      0,
    );
    const totalMB = (totalSize / 1024 / 1024).toFixed(2);

    console.log('\n=== Total Cache Size ===');
    console.log(`${totalMB} MB`);

    if (parseFloat(totalMB) > 5) {
      console.log('\n⚠️  Cache size exceeds 5 MB. Consider using Git LFS:');
      console.log('   git lfs track "src/data/wikidata/*.json"');
      console.log('   git add .gitattributes');
    }

    console.log(`\n✓ Wikidata cache generated successfully in ${outputDir}`);
  } catch (error) {
    console.error('Error fetching Wikidata cache:', error);
    process.exit(1);
  }
}

main();
