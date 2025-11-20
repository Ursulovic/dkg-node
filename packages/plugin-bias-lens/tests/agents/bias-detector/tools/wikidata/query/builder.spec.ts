import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildSparqlQuery } from '../../../../../../src/agents/bias-detector/tools/wikidata/query/builder.js';

describe('Wikidata Query Builder', () => {
  it('should generate valid SPARQL query with entity and property IDs', () => {
    const query = buildSparqlQuery('Q312', 'P571');

    expect(query).to.include('wd:Q312');
    expect(query).to.include('wdt:P571');
    expect(query).to.include('PREFIX wd:');
    expect(query).to.include('PREFIX wdt:');
    expect(query).to.include('SELECT ?value ?valueLabel');
    expect(query).to.include('LIMIT 1');
  });

  it('should work with different entity and property combinations', () => {
    const query1 = buildSparqlQuery('Q5', 'P569');
    expect(query1).to.include('wd:Q5');
    expect(query1).to.include('wdt:P569');

    const query2 = buildSparqlQuery('Q478214', 'P571');
    expect(query2).to.include('wd:Q478214');
    expect(query2).to.include('wdt:P571');
  });

  it('should include wikibase label service', () => {
    const query = buildSparqlQuery('Q123', 'P456');

    expect(query).to.include('SERVICE wikibase:label');
    expect(query).to.include('bd:serviceParam wikibase:language "en"');
  });

  it('should maintain proper SPARQL query structure', () => {
    const query = buildSparqlQuery('Q999', 'P888');

    expect(query).to.include('WHERE {');
    expect(query).to.include('wd:Q999 wdt:P888 ?value');
  });
});
