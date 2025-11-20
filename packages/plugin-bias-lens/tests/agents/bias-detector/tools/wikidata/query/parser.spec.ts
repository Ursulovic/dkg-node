import { describe, it } from 'mocha';
import { expect } from 'chai';
import { parseWikidataResponse } from '../../../../../../src/agents/bias-detector/tools/wikidata/query/parser.js';
import type { SparqlResult } from '../../../../../../src/agents/bias-detector/tools/wikidata/types.js';

describe('Wikidata Response Parser', () => {
  it('should parse integer values', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'literal',
              value: '13929286',
              datatype: 'http://www.w3.org/2001/XMLSchema#integer',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q64', 'population');

    expect(result).to.exist;
    expect(result!.property).to.equal('population');
    expect(result!.value).to.equal(13929286);
    expect(result!.wikidataEntityId).to.equal('Q64');
    expect(result!.wikidataUrl).to.equal('https://www.wikidata.org/wiki/Q64');
  });

  it('should parse decimal values', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'literal',
              value: '891.85',
              datatype: 'http://www.w3.org/2001/XMLSchema#decimal',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q64', 'area');

    expect(result).to.exist;
    expect(result!.value).to.equal(891.85);
  });

  it('should parse date values to ISO format', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'literal',
              value: '2003-07-01T00:00:00Z',
              datatype: 'http://www.w3.org/2001/XMLSchema#dateTime',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q478214', 'inception');

    expect(result).to.exist;
    expect(result!.value).to.equal('2003-07-01');
  });

  it('should parse entity references with labels', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value', 'valueLabel'] },
      results: {
        bindings: [
          {
            value: {
              type: 'uri',
              value: 'http://www.wikidata.org/entity/Q515',
            },
            valueLabel: {
              type: 'literal',
              value: 'city',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q64', 'instance of');

    expect(result).to.exist;
    expect(result!.value).to.equal('city');
  });

  it('should parse entity references without labels', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'uri',
              value: 'http://www.wikidata.org/entity/Q515',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q64', 'instance of');

    expect(result).to.exist;
    expect(result!.value).to.equal('Q515');
  });

  it('should parse string values', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'literal',
              value: 'Some text value',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q123', 'description');

    expect(result).to.exist;
    expect(result!.value).to.equal('Some text value');
  });

  it('should return null for empty results', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q123', 'test');

    expect(result).to.be.null;
  });

  it('should return null for missing value binding', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [{}],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q123', 'test');

    expect(result).to.be.null;
  });

  it('should include empty references array', () => {
    const sparqlResult: SparqlResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          {
            value: {
              type: 'literal',
              value: '42',
            },
          },
        ],
      },
    };

    const result = parseWikidataResponse(sparqlResult, 'Q123', 'test');

    expect(result).to.exist;
    expect(result!.references).to.be.an('array');
    expect(result!.references).to.have.lengthOf(0);
  });
});
