import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { ConstraintValidator } from '../../../../../../src/agents/bias-detector/tools/wikidata/resolvers/constraint-validator.js';

describe('Constraint Validator', () => {
  let validator: ConstraintValidator;

  beforeEach(() => {
    validator = new ConstraintValidator();
  });

  it('should validate when property has no constraints', () => {
    const result = validator.validate('P999999', 'Q123', 'Q5');

    expect(result.valid).to.be.true;
    expect(result.error).to.be.undefined;
  });

  it('should validate when entity type matches constraint', () => {
    const result = validator.validate('P569', 'Q42', 'Q5');

    expect(result.valid).to.be.true;
  });

  it('should fail validation when entity type does not match constraint', () => {
    const result = validator.validate('P569', 'Q478214', 'Q4830453');

    expect(result.valid).to.be.false;
    expect(result.error).to.exist;
    expect(result.error).to.include('P569');
    expect(result.error).to.include('Q4830453');
  });

  it('should include property label in error message', () => {
    const result = validator.validate('P569', 'Q123', 'Q4830453');

    expect(result.valid).to.be.false;
    expect(result.error).to.include('date of birth');
  });

  it('should include allowed types in error message', () => {
    const result = validator.validate('P569', 'Q123', 'Q4830453');

    expect(result.valid).to.be.false;
    expect(result.error).to.include('requires entity type');
  });

  it('should validate when entityType is undefined', () => {
    const result = validator.validate('P569', 'Q123', undefined);

    expect(result.valid).to.be.true;
  });

  it('should handle properties with multiple constraints', () => {
    const result1 = validator.validate('P571', 'Q478214', 'Q4830453');
    expect(result1.valid).to.be.true;

    const result2 = validator.validate('P571', 'Q515', 'Q515');
    expect(result2.valid).to.be.true;
  });

  it('should validate common property/entity type combinations', () => {
    const validCombinations = [
      { property: 'P569', entityType: 'Q5', description: 'birth date on human' },
      { property: 'P570', entityType: 'Q5', description: 'death date on human' },
      { property: 'P571', entityType: 'Q4830453', description: 'inception on business' },
    ];

    validCombinations.forEach(({ property, entityType, description }) => {
      const result = validator.validate(property, 'Q123', entityType);
      expect(result.valid).to.be.true;
    });
  });
});
