import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { PropertyResolver } from '../../../../../../src/agents/bias-detector/tools/wikidata/resolvers/property-resolver.js';

describe('Property Resolver', () => {
  let resolver: PropertyResolver;

  beforeEach(() => {
    resolver = new PropertyResolver();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findProperty', () => {
    it('should find property by exact label match', () => {
      const result = resolver.findProperty('inception');

      expect(result).to.exist;
      expect(result!.id).to.equal('P571');
      expect(result!.label).to.equal('inception');
    });

    it('should find property with typo tolerance', () => {
      const result = resolver.findProperty('populaton');

      expect(result).to.exist;
      expect(result!.id).to.equal('P1082');
      expect(result!.label).to.equal('population');
    });

    it('should find property by alias', () => {
      const result = resolver.findProperty('date of foundation');

      expect(result).to.exist;
      expect(result!.id).to.equal('P571');
    });

    it('should return null for very poor matches', () => {
      const result = resolver.findProperty('xyzabc123');

      expect(result).to.be.null;
    });

    it('should return null for queries below minimum match length', () => {
      const result = resolver.findProperty('xy');

      expect(result).to.be.null;
    });

    it('should find common properties', () => {
      const tests = [
        { query: 'population', expected: 'P1082' },
        { query: 'area', expected: 'P2046' },
        { query: 'capital', expected: 'P36' },
        { query: 'founder', expected: 'P112' },
      ];

      tests.forEach(({ query, expected }) => {
        const result = resolver.findProperty(query);
        expect(result).to.exist;
        expect(result!.id).to.equal(expected);
      });
    });
  });

  describe('findPropertyWithFallback', () => {
    it('should return local result when found', async () => {
      const result = await resolver.findPropertyWithFallback('inception');

      expect(result).to.exist;
      expect(result!.id).to.equal('P571');
    });

    it('should fallback to API when not found locally', async () => {
      sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          search: [
            {
              id: 'P9999',
              label: 'custom property',
              description: 'A custom property',
            },
          ],
        }),
      } as Response);

      const result = await resolver.findPropertyWithFallback('very specific custom property');

      expect(result).to.exist;
      expect(result!.id).to.equal('P9999');
      expect(result!.label).to.equal('custom property');
    });

    it('should return null when API returns no results', async () => {
      sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({ search: [] }),
      } as Response);

      const result = await resolver.findPropertyWithFallback('nonexistent12345');

      expect(result).to.be.null;
    });

    it('should propagate API errors', async () => {
      sinon.stub(global, 'fetch').rejects(new Error('API error'));

      try {
        await resolver.findPropertyWithFallback('test567');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal('API error');
      }
    });

    it.skip('should cache API results for repeated searches', async () => {
      const uniqueTerm = 'xyzuniqueprop999';
      const fetchStub = sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          search: [{ id: 'P8888', label: uniqueTerm, aliases: [], datatype: 'unknown' }],
        }),
      } as Response);

      const result1 = await resolver.findPropertyWithFallback(uniqueTerm);
      const result2 = await resolver.findPropertyWithFallback(uniqueTerm);

      expect(result1).to.exist;
      expect(result2).to.exist;
      expect(result1!.id).to.equal(result2!.id);
      expect(fetchStub.calledOnce).to.be.true;
    });
  });
});
