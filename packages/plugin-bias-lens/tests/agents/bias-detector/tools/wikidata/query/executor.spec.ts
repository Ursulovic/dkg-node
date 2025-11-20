import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { executeSparql } from '../../../../../../src/agents/bias-detector/tools/wikidata/query/executor.js';

describe('SPARQL Query Executor', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should execute SPARQL query successfully', async () => {
    const mockResult = {
      head: { vars: ['value'] },
      results: {
        bindings: [
          { value: { type: 'literal', value: '2003-07-01' } },
        ],
      },
    };

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      status: 200,
      json: async () => mockResult,
    } as Response);

    const query = 'SELECT ?value WHERE { wd:Q123 wdt:P571 ?value }';
    const result = await executeSparql(query);

    expect(result).to.deep.equal(mockResult);
    expect(fetchStub.calledOnce).to.be.true;

    const callUrl = fetchStub.firstCall.args[0] as string;
    expect(callUrl).to.include('query.wikidata.org/sparql');
    expect(callUrl).to.include('format=json');
  });

  it('should include User-Agent header', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({}),
    } as Response);

    await executeSparql('SELECT * WHERE {}');

    const fetchCall = (global.fetch as sinon.SinonStub).firstCall;
    const options = fetchCall.args[1] as RequestInit;
    expect(options.headers).to.deep.include({ 'User-Agent': 'plugin-bias-lens/1.0' });
  });

  it('should throw error on HTTP error status', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 500,
    } as Response);

    try {
      await executeSparql('SELECT * WHERE {}');
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('SPARQL query failed: 500');
    }
  });

  it.skip('should throw error on timeout', async function () {
    this.timeout(7000);

    sinon.stub(global, 'fetch').callsFake(async () => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      return { ok: true, json: async () => ({}) } as Response;
    });

    try {
      await executeSparql('SELECT * WHERE {}');
      expect.fail('Should have thrown timeout error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
    }
  });

  it('should handle network errors', async () => {
    sinon.stub(global, 'fetch').rejects(new Error('Network failure'));

    try {
      await executeSparql('SELECT * WHERE {}');
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('Network failure');
    }
  });

  it('should encode query in URL', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({}),
    } as Response);

    const query = 'SELECT ?x WHERE { ?x ?y "test value" }';
    await executeSparql(query);

    const callUrl = fetchStub.firstCall.args[0] as string;
    expect(callUrl).to.include('query=');
    expect(decodeURIComponent(callUrl)).to.include(query);
  });
});
