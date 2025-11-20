import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { EntityTypeResolver } from '../../../../../../src/agents/bias-detector/tools/wikidata/resolvers/entity-type-resolver.js';

describe('Entity Type Resolver', () => {
  let resolver: EntityTypeResolver;

  beforeEach(() => {
    resolver = new EntityTypeResolver();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getType', () => {
    it('should retrieve cached entity type by ID', () => {
      const type = resolver.getType('Q5');

      expect(type).to.exist;
      expect(type!.id).to.equal('Q5');
      expect(type!.label).to.equal('human');
    });

    it('should return undefined for unknown type ID', () => {
      const type = resolver.getType('Q999999999');

      expect(type).to.be.undefined;
    });

    it('should retrieve common entity types', () => {
      const commonTypes = ['Q5', 'Q515', 'Q6256', 'Q4830453'];

      commonTypes.forEach((typeId) => {
        const type = resolver.getType(typeId);
        expect(type).to.exist;
        expect(type!.id).to.equal(typeId);
      });
    });
  });

  describe('resolveEntityType', () => {
    it('should resolve entity type from Wikidata API', async () => {
      sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          entities: {
            Q42: {
              claims: {
                P31: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: {
                          id: 'Q5',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      } as Response);

      const result = await resolver.resolveEntityType('Q42');

      expect(result).to.equal('Q5');
    });

    it('should return undefined for entity without P31 claim', async () => {
      sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          entities: {
            Q123: {
              claims: {},
            },
          },
        }),
      } as Response);

      const result = await resolver.resolveEntityType('Q123');

      expect(result).to.be.undefined;
    });

    it('should return undefined for entity without claims', async () => {
      sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          entities: {
            Q123: {},
          },
        }),
      } as Response);

      const result = await resolver.resolveEntityType('Q123');

      expect(result).to.be.undefined;
    });

    it('should return undefined on API error', async () => {
      sinon.stub(global, 'fetch').rejects(new Error('Network error'));

      const result = await resolver.resolveEntityType('Q123');

      expect(result).to.be.undefined;
    });

    it('should call Wikidata API with correct parameters', async () => {
      const fetchStub = sinon.stub(global, 'fetch').resolves({
        ok: true,
        json: async () => ({
          entities: {
            Q478214: {
              claims: {
                P31: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: {
                          id: 'Q4830453',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      } as Response);

      await resolver.resolveEntityType('Q478214');

      expect(fetchStub.calledOnce).to.be.true;
      const callUrl = fetchStub.firstCall.args[0] as string;
      expect(callUrl).to.include('wbgetentities');
      expect(callUrl).to.include('ids=Q478214');
      expect(callUrl).to.include('props=claims');
    });
  });
});
