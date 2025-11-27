import { describe, it } from "mocha";
import { expect } from "chai";
import {
  termSchema,
  tripleSchema,
  bgpPatternSchema,
  selectQuerySchema,
} from "../../../../src/tools/dkg-query/sparql/schema.js";

describe("SPARQL.js Zod Schemas", () => {
  describe("termSchema", () => {
    it("should validate Variable term", () => {
      const term = { termType: "Variable", value: "name" };
      const result = termSchema.safeParse(term);
      expect(result.success).to.be.true;
    });

    it("should validate NamedNode term", () => {
      const term = { termType: "NamedNode", value: "http://schema.org/name" };
      const result = termSchema.safeParse(term);
      expect(result.success).to.be.true;
    });

    it("should validate Literal term", () => {
      const term = { termType: "Literal", value: "Hello", language: "en" };
      const result = termSchema.safeParse(term);
      expect(result.success).to.be.true;
    });

    it("should validate Literal with datatype", () => {
      const term = {
        termType: "Literal",
        value: "42",
        datatype: {
          termType: "NamedNode",
          value: "http://www.w3.org/2001/XMLSchema#integer",
        },
      };
      const result = termSchema.safeParse(term);
      expect(result.success).to.be.true;
    });

    it("should reject invalid termType", () => {
      const term = { termType: "Invalid", value: "test" };
      const result = termSchema.safeParse(term);
      expect(result.success).to.be.false;
    });
  });

  describe("tripleSchema", () => {
    it("should validate complete triple", () => {
      const triple = {
        subject: { termType: "Variable", value: "s" },
        predicate: { termType: "NamedNode", value: "http://schema.org/name" },
        object: { termType: "Variable", value: "name" },
      };
      const result = tripleSchema.safeParse(triple);
      expect(result.success).to.be.true;
    });

    it("should reject triple missing predicate", () => {
      const triple = {
        subject: { termType: "Variable", value: "s" },
        object: { termType: "Variable", value: "name" },
      };
      const result = tripleSchema.safeParse(triple);
      expect(result.success).to.be.false;
    });
  });

  describe("bgpPatternSchema", () => {
    it("should validate BGP with triples", () => {
      const bgp = {
        type: "bgp",
        triples: [
          {
            subject: { termType: "Variable", value: "s" },
            predicate: {
              termType: "NamedNode",
              value: "http://schema.org/name",
            },
            object: { termType: "Variable", value: "name" },
          },
        ],
      };
      const result = bgpPatternSchema.safeParse(bgp);
      expect(result.success).to.be.true;
    });

    it("should validate BGP with empty triples", () => {
      const bgp = { type: "bgp", triples: [] };
      const result = bgpPatternSchema.safeParse(bgp);
      expect(result.success).to.be.true;
    });
  });

  describe("selectQuerySchema", () => {
    it("should validate complete SELECT query", () => {
      const query = {
        queryType: "SELECT",
        variables: [{ termType: "Variable", value: "name" }],
        where: [
          {
            type: "bgp",
            triples: [
              {
                subject: { termType: "Variable", value: "s" },
                predicate: {
                  termType: "NamedNode",
                  value: "http://schema.org/name",
                },
                object: { termType: "Variable", value: "name" },
              },
            ],
          },
        ],
        prefixes: { schema: "http://schema.org/" },
      };
      const result = selectQuerySchema.safeParse(query);
      expect(result.success).to.be.true;
    });

    it("should validate query with LIMIT", () => {
      const query = {
        queryType: "SELECT",
        variables: [{ termType: "Variable", value: "s" }],
        where: [{ type: "bgp", triples: [] }],
        prefixes: {},
        limit: 10,
      };
      const result = selectQuerySchema.safeParse(query);
      expect(result.success).to.be.true;
    });

    it("should validate query with ORDER BY", () => {
      const query = {
        queryType: "SELECT",
        variables: [{ termType: "Variable", value: "s" }],
        where: [{ type: "bgp", triples: [] }],
        prefixes: {},
        order: [
          {
            expression: { termType: "Variable", value: "s" },
            descending: true,
          },
        ],
      };
      const result = selectQuerySchema.safeParse(query);
      expect(result.success).to.be.true;
    });

    it("should validate query with aggregation", () => {
      const query = {
        queryType: "SELECT",
        variables: [
          {
            expression: {
              type: "aggregate",
              aggregation: "count",
              expression: { termType: "Variable", value: "s" },
            },
            variable: { termType: "Variable", value: "count" },
          },
        ],
        where: [{ type: "bgp", triples: [] }],
        prefixes: {},
      };
      const result = selectQuerySchema.safeParse(query);
      expect(result.success).to.be.true;
    });

    it("should reject query with invalid queryType", () => {
      const query = {
        queryType: "INSERT",
        variables: [],
        where: [],
        prefixes: {},
      };
      const result = selectQuerySchema.safeParse(query);
      expect(result.success).to.be.false;
    });
  });
});
