import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { textToWikidataSparqlTool } from '../../../../../src/agents/bias-detector/tools/wikidata/index.js';

describe('Text-to-Wikidata-SPARQL Tool (Integration)', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should have correct schema with natural language query input', () => {
    expect(textToWikidataSparqlTool.name).to.equal('text_to_wikidata_sparql');
    expect(textToWikidataSparqlTool.description).to.include('Natural language interface');
    expect(textToWikidataSparqlTool.description).to.include('knowledge graph');
  });

  it('should accept query parameter', async () => {
    const schema = textToWikidataSparqlTool.schema;
    expect(schema).to.exist;

    const parseResult = schema.safeParse({ query: 'When did George Floyd die?' });
    expect(parseResult.success).to.be.true;
  });

  it('should reject empty query', async () => {
    const schema = textToWikidataSparqlTool.schema;
    const parseResult = schema.safeParse({});
    expect(parseResult.success).to.be.false;
  });

  it('should handle errors gracefully without throwing', async function() {
    this.timeout(10000);

    fetchStub.rejects(new Error('Network error'));

    let error: Error | null = null;
    let result;
    try {
      result = await textToWikidataSparqlTool.func({ query: 'test query' });
    } catch (e) {
      error = e as Error;
    }

    expect(error).to.be.null;
    expect(result).to.be.a('string');
  });
});

describe('Wikidata Query Handler (Unit)', () => {
  it('should be a placeholder for future unit tests', () => {
    expect(true).to.be.true;
  });
});
