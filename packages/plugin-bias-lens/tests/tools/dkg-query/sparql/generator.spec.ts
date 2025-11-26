import { describe, it } from "mocha";
import { expect } from "chai";
import {
  generateSparql,
  validateSparql,
  wrapWithDkgGraphPattern,
  createSimpleSelectQuery,
} from "../../../../src/tools/dkg-query/sparql/generator.js";
import type { SelectQueryJson } from "../../../../src/tools/dkg-query/sparql/schema.js";

describe("SPARQL Generator", () => {
  describe("generateSparql", () => {
    it("should generate valid SPARQL from JSON query", () => {
      const queryJson: SelectQueryJson = {
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

      const sparql = generateSparql(queryJson);

      expect(sparql).to.include("SELECT");
      expect(sparql).to.include("?name");
      expect(sparql).to.include("schema:name");
    });

    it("should handle aggregation queries", () => {
      const queryJson: SelectQueryJson = {
        queryType: "SELECT",
        variables: [
          {
            expression: {
              type: "aggregate",
              aggregation: "count",
              expression: { termType: "Variable", value: "s" },
              distinct: true,
            },
            variable: { termType: "Variable", value: "count" },
          },
        ],
        where: [
          {
            type: "bgp",
            triples: [
              {
                subject: { termType: "Variable", value: "s" },
                predicate: {
                  termType: "NamedNode",
                  value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                object: {
                  termType: "NamedNode",
                  value: "http://schema.org/Product",
                },
              },
            ],
          },
        ],
        prefixes: {
          schema: "http://schema.org/",
          rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        },
      };

      const sparql = generateSparql(queryJson);

      expect(sparql).to.include("COUNT");
      expect(sparql).to.include("DISTINCT");
    });

    it("should handle LIMIT and ORDER BY", () => {
      const queryJson: SelectQueryJson = {
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
        limit: 10,
        order: [
          {
            expression: { termType: "Variable", value: "name" },
            descending: true,
          },
        ],
      };

      const sparql = generateSparql(queryJson);

      expect(sparql).to.include("LIMIT 10");
      expect(sparql).to.include("ORDER BY");
      expect(sparql).to.include("DESC");
    });
  });

  describe("validateSparql", () => {
    it("should validate correct SPARQL", () => {
      const sparql = "SELECT ?s WHERE { ?s ?p ?o }";
      const result = validateSparql(sparql);

      expect(result.valid).to.be.true;
      expect(result.error).to.be.undefined;
    });

    it("should detect invalid SPARQL", () => {
      const sparql = "SELECT ?s WHERE { ?s ?p }";
      const result = validateSparql(sparql);

      expect(result.valid).to.be.false;
      expect(result.error).to.be.a("string");
    });
  });

  describe("wrapWithDkgGraphPattern", () => {
    it("should wrap query with DKG graph traversal", () => {
      const queryJson: SelectQueryJson = {
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

      const wrapped = wrapWithDkgGraphPattern(queryJson);

      expect(wrapped.prefixes).to.have.property("dkg");
      expect(wrapped.where).to.have.length(2);

      const sparql = generateSparql(wrapped);
      expect(sparql).to.include("current:graph");
      expect(sparql).to.include("hasNamedGraph");
    });
  });

  describe("createSimpleSelectQuery", () => {
    it("should create a simple SELECT query", () => {
      const query = createSimpleSelectQuery(
        ["?name", "?age"],
        [
          {
            subject: "?s",
            predicate: "http://schema.org/name",
            object: "?name",
          },
          { subject: "?s", predicate: "http://schema.org/age", object: "?age" },
        ],
        { schema: "http://schema.org/" }
      );

      expect(query.queryType).to.equal("SELECT");
      expect(query.variables).to.have.length(2);
      expect((query.where[0] as { triples: unknown[] }).triples).to.have.length(2);
    });
  });
});
