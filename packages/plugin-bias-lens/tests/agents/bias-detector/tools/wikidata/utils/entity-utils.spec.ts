import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { resolveEntity } from '../../../../../../src/agents/bias-detector/tools/wikidata/utils/entity-utils.js';

describe('Entity Resolution Utilities', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should resolve entity by name', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({
        search: [
          {
            id: 'Q478214',
            label: 'Tesla Inc.',
            description: 'American electric vehicle manufacturer',
          },
        ],
      }),
    } as Response);

    const result = await resolveEntity('Tesla Inc');

    expect(result).to.exist;
    expect(result!.entityId).to.equal('Q478214');
    expect(result!.label).to.equal('Tesla Inc.');
    expect(result!.description).to.equal('American electric vehicle manufacturer');

    expect(fetchStub.calledOnce).to.be.true;
    const callUrl = fetchStub.firstCall.args[0] as string;
    expect(callUrl).to.include('wbsearchentities');
    expect(callUrl).to.include('search=Tesla');
    expect(callUrl).to.include('type=item');
  });

  it('should return first search result', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({
        search: [
          { id: 'Q1', label: 'First', description: 'First result' },
          { id: 'Q2', label: 'Second', description: 'Second result' },
        ],
      }),
    } as Response);

    const result = await resolveEntity('test');

    expect(result).to.exist;
    expect(result!.entityId).to.equal('Q1');
    expect(result!.label).to.equal('First');
  });

  it('should return null when no results found', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({
        search: [],
      }),
    } as Response);

    const result = await resolveEntity('NonexistentEntity123');

    expect(result).to.be.null;
  });

  it('should return null on API error', async () => {
    sinon.stub(global, 'fetch').rejects(new Error('Network error'));

    const result = await resolveEntity('test');

    expect(result).to.be.null;
  });

  it('should handle missing search property', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await resolveEntity('test');

    expect(result).to.be.null;
  });

  it('should handle entity without description', async () => {
    sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({
        search: [
          { id: 'Q123', label: 'Test Entity' },
        ],
      }),
    } as Response);

    const result = await resolveEntity('test');

    expect(result).to.exist;
    expect(result!.entityId).to.equal('Q123');
    expect(result!.label).to.equal('Test Entity');
    expect(result!.description).to.be.undefined;
  });
});
