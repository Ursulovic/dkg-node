import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  extractPropertyKeyword,
  extractEntityFromQuery,
} from '../../../../../../src/agents/bias-detector/tools/wikidata/utils/query-parsing.js';

describe('Wikidata Query Parsing', () => {
  describe('extractPropertyKeyword', () => {
    it('should extract inception from founding-related queries', () => {
      expect(extractPropertyKeyword('When was Tesla founded?')).to.equal('inception');
      expect(extractPropertyKeyword('established in 2003')).to.equal('inception');
      expect(extractPropertyKeyword('created last year')).to.equal('inception');
      expect(extractPropertyKeyword('started operations')).to.equal('inception');
    });

    it('should extract date of birth from birth queries', () => {
      expect(extractPropertyKeyword('When was Einstein born?')).to.equal('date of birth');
      expect(extractPropertyKeyword('What is his birth date?')).to.equal('date of birth');
    });

    it('should extract date of death from death queries', () => {
      expect(extractPropertyKeyword('When did he die?')).to.equal('date of death');
    });

    it('should extract population from population queries', () => {
      expect(extractPropertyKeyword('What is the population?')).to.equal('population');
      expect(extractPropertyKeyword('How many inhabitants?')).to.equal('population');
    });

    it('should extract area from size queries', () => {
      expect(extractPropertyKeyword('What is the area?')).to.equal('area');
      expect(extractPropertyKeyword('How big is the size?')).to.equal('area');
    });

    it('should extract height from height queries', () => {
      expect(extractPropertyKeyword('How tall is he?')).to.equal('height');
      expect(extractPropertyKeyword('What is the height?')).to.equal('height');
    });

    it('should extract chief executive officer from CEO queries', () => {
      expect(extractPropertyKeyword('Who is the CEO?')).to.equal('chief executive officer');
      expect(extractPropertyKeyword('chief executive')).to.equal('chief executive officer');
    });

    it('should extract founder from founder queries', () => {
      expect(extractPropertyKeyword('Who is the founder?')).to.equal('founder');
      expect(extractPropertyKeyword('The founder was')).to.equal('founder');
    });

    it('should extract headquarters location from HQ queries', () => {
      expect(extractPropertyKeyword('Where is the headquarters?')).to.equal('headquarters location');
      expect(extractPropertyKeyword('headquartered in')).to.equal('headquarters location');
      expect(extractPropertyKeyword('HQ location')).to.equal('headquarters location');
    });

    it('should extract capital from capital queries', () => {
      expect(extractPropertyKeyword('What is the capital?')).to.equal('capital');
    });

    it('should extract country of citizenship from nationality queries', () => {
      expect(extractPropertyKeyword('What is his nationality?')).to.equal('country of citizenship');
      expect(extractPropertyKeyword('Is she a citizen?')).to.equal('country of citizenship');
    });

    it('should extract occupation from job queries', () => {
      expect(extractPropertyKeyword('What is her occupation?')).to.equal('occupation');
      expect(extractPropertyKeyword('What profession?')).to.equal('occupation');
      expect(extractPropertyKeyword('What job?')).to.equal('occupation');
    });

    it('should return null for unrecognized queries', () => {
      expect(extractPropertyKeyword('What is this?')).to.be.null;
      expect(extractPropertyKeyword('Tell me about it')).to.be.null;
      expect(extractPropertyKeyword('Random text')).to.be.null;
    });
  });

  describe('extractEntityFromQuery', () => {
    it('should extract entity names and remove property keywords', () => {
      expect(extractEntityFromQuery('When was Tesla founded?')).to.include('Tesla');
      expect(extractEntityFromQuery('What is the population of Tokyo?')).to.include('Tokyo');
      expect(extractEntityFromQuery('Who is the CEO of Microsoft?')).to.include('Microsoft');
    });

    it('should remove question words', () => {
      expect(extractEntityFromQuery('What is Paris?')).to.equal('Paris');
    });

    it('should remove question marks', () => {
      expect(extractEntityFromQuery('Tesla Inc?')).to.include('Tesla Inc');
    });

    it('should handle multi-word entities with property keywords removed', () => {
      const result = extractEntityFromQuery('Population of New York City?');
      expect(result).to.include('New');
      expect(result).to.include('York');
      expect(result).to.include('City');
    });

    it('should keep words longer than 2 characters', () => {
      const result = extractEntityFromQuery('What is the CEO of XYZ Corp?');
      expect(result).to.include('XYZ');
      expect(result).to.include('Corp');
    });

    it('should return null for empty results', () => {
      expect(extractEntityFromQuery('What?')).to.be.null;
      expect(extractEntityFromQuery('When?')).to.be.null;
      expect(extractEntityFromQuery('??')).to.be.null;
    });

    it('should handle queries without question words', () => {
      const result1 = extractEntityFromQuery('Tesla Inc');
      expect(result1).to.include('Tesla');
      expect(result1).to.include('Inc');

      expect(extractEntityFromQuery('Paris population')).to.equal('Paris');
    });
  });
});
