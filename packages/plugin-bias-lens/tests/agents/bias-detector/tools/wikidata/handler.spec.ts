import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { wikidataQueryHandler } from '../../../../../src/agents/bias-detector/tools/wikidata/handler.js';

describe('Wikidata Query Handler (Integration)', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should execute successful end-to-end query', async () => {
    sinon.stub(global, 'fetch').callsFake(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [
              { id: 'Q478214', label: 'Tesla Inc.', description: 'Electric vehicle company' },
            ],
          }),
        } as Response;
      }

      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q478214: {
                claims: {
                  P31: [
                    { mainsnak: { datavalue: { value: { id: 'Q4830453' } } } },
                  ],
                },
              },
            },
          }),
        } as Response;
      }

      if (urlStr.includes('query.wikidata.org/sparql')) {
        return {
          ok: true,
          json: async () => ({
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
          }),
        } as Response;
      }

      throw new Error('Unexpected URL');
    });

    const result = await wikidataQueryHandler({
      entity: 'Tesla Inc',
      property: 'inception',
    });

    expect(result.success).to.be.true;
    expect(result.data).to.exist;
    expect(result.data!.property).to.equal('inception');
    expect(result.data!.value).to.equal('2003-07-01');
    expect(result.data!.wikidataEntityId).to.equal('Q478214');
  });


  it('should return error when entity not found', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({ search: [] }),
    } as Response);

    const result = await wikidataQueryHandler({
      entity: 'Nonexistent123',
      property: 'inception',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.exist;
    expect(result.error).to.include('not found');
  });

  it('should return error when cannot determine property', async () => {
    sinon.stub(global, 'fetch').callsFake(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('wbsearchentities') && urlStr.includes('search=Test')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q123', label: 'Test' }],
          }),
        } as Response;
      }

      if (urlStr.includes('wbsearchentities') && urlStr.includes('type=property')) {
        return {
          ok: true,
          json: async () => ({
            search: [],
          }),
        } as Response;
      }

      throw new Error('Unexpected URL');
    });

    const result = await wikidataQueryHandler({
      entity: 'Test',
      property: 'nonexistent12345property',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.include('not found');
  });

  it('should return error when constraint validation fails', async () => {
    sinon.stub(global, 'fetch').callsFake(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q478214', label: 'Tesla Inc.' }],
          }),
        } as Response;
      }

      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q478214: {
                claims: {
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q4830453' } } } }],
                },
              },
            },
          }),
        } as Response;
      }

      throw new Error('Unexpected URL');
    });

    const result = await wikidataQueryHandler({
      entity: 'Tesla Inc',
      property: 'date of birth',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.exist;
    expect(result.error).to.include('requires entity type');
  });

  it('should return error when SPARQL query fails', async () => {
    sinon.stub(global, 'fetch').callsFake(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q123', label: 'Test' }],
          }),
        } as Response;
      }

      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: { Q123: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] } } },
          }),
        } as Response;
      }

      if (urlStr.includes('sparql')) {
        return {
          ok: false,
          status: 500,
        } as Response;
      }

      throw new Error('Unexpected URL');
    });

    const result = await wikidataQueryHandler({
      entity: 'Test',
      property: 'date of birth',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.include('SPARQL query failed');
  });

  it('should return error when no data in SPARQL results', async () => {
    sinon.stub(global, 'fetch').callsFake(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q123', label: 'Test' }],
          }),
        } as Response;
      }

      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: { Q123: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] } } },
          }),
        } as Response;
      }

      if (urlStr.includes('sparql')) {
        return {
          ok: true,
          json: async () => ({
            head: { vars: ['value'] },
            results: { bindings: [] },
          }),
        } as Response;
      }

      throw new Error('Unexpected URL');
    });

    const result = await wikidataQueryHandler({
      entity: 'Test',
      property: 'date of birth',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.include('No data available');
  });

  it.skip('should handle unexpected errors gracefully', async () => {
    const result = await wikidataQueryHandler({
      entity: 'InvalidEntity123',
      property: 'invalid-property',
    });

    expect(result.success).to.be.false;
    expect(result.error).to.exist;
  });
});
