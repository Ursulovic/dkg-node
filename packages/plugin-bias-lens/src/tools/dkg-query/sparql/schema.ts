import { z } from "zod";

const variableTermSchema = z.object({
  termType: z.literal("Variable"),
  value: z.string(),
});

const namedNodeTermSchema = z.object({
  termType: z.literal("NamedNode"),
  value: z.string(),
});

const literalTermSchema = z.object({
  termType: z.literal("Literal"),
  value: z.string(),
  language: z.string().nullish(),
  datatype: namedNodeTermSchema.nullish(),
});

const blankTermSchema = z.object({
  termType: z.literal("BlankNode"),
  value: z.string(),
});

export const termSchema = z.discriminatedUnion("termType", [
  variableTermSchema,
  namedNodeTermSchema,
  literalTermSchema,
  blankTermSchema,
]);

export const tripleSchema = z.object({
  subject: termSchema,
  predicate: termSchema,
  object: termSchema,
});

export const bgpPatternSchema = z.object({
  type: z.literal("bgp"),
  triples: z.array(tripleSchema),
});

const operationExpressionSchema = z.object({
  type: z.literal("operation"),
  operator: z.string(),
  args: z.array(z.any()),
});

const aggregateExpressionSchema = z.object({
  type: z.literal("aggregate"),
  aggregation: z.enum(["count", "sum", "avg", "min", "max", "group_concat", "sample"]),
  expression: z.any(),
  distinct: z.boolean().nullish(),
  separator: z.string().nullish(),
});

const functionCallExpressionSchema = z.object({
  type: z.literal("functionCall"),
  function: z.string(),
  args: z.array(z.any()),
});

export const expressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    termSchema,
    operationExpressionSchema,
    aggregateExpressionSchema,
    functionCallExpressionSchema,
  ])
);

export const filterPatternSchema = z.object({
  type: z.literal("filter"),
  expression: expressionSchema,
});

export const bindPatternSchema = z.object({
  type: z.literal("bind"),
  variable: variableTermSchema,
  expression: expressionSchema,
});

export const valuesPatternSchema = z.object({
  type: z.literal("values"),
  values: z.array(z.record(z.any())),
});

export const patternSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    bgpPatternSchema,
    filterPatternSchema,
    bindPatternSchema,
    valuesPatternSchema,
    optionalPatternSchema,
    unionPatternSchema,
    groupPatternSchema,
    graphPatternSchema,
    minusPatternSchema,
    servicePatternSchema,
  ])
);

export const optionalPatternSchema = z.object({
  type: z.literal("optional"),
  patterns: z.array(patternSchema),
});

export const unionPatternSchema = z.object({
  type: z.literal("union"),
  patterns: z.array(z.array(patternSchema)),
});

export const groupPatternSchema = z.object({
  type: z.literal("group"),
  patterns: z.array(patternSchema),
});

export const graphPatternSchema = z.object({
  type: z.literal("graph"),
  name: termSchema,
  patterns: z.array(patternSchema),
});

export const minusPatternSchema = z.object({
  type: z.literal("minus"),
  patterns: z.array(patternSchema),
});

export const servicePatternSchema = z.object({
  type: z.literal("service"),
  name: termSchema,
  patterns: z.array(patternSchema),
  silent: z.boolean().nullish(),
});

const variableExpressionSchema = z.object({
  expression: expressionSchema,
  variable: variableTermSchema,
});

export const orderingSchema = z.object({
  expression: expressionSchema,
  descending: z.boolean().nullish(),
});

export const groupingSchema = z.object({
  expression: expressionSchema,
});

export const selectQuerySchema = z.object({
  queryType: z.literal("SELECT"),
  type: z.literal("query").nullish(),
  variables: z.array(z.union([variableTermSchema, variableExpressionSchema, z.literal("*")])),
  where: z.array(patternSchema),
  prefixes: z.record(z.string()),
  base: z.string().nullish(),
  from: z
    .object({
      default: z.array(namedNodeTermSchema).nullish(),
      named: z.array(namedNodeTermSchema).nullish(),
    })
    .nullish(),
  group: z.array(groupingSchema).nullish(),
  having: z.array(expressionSchema).nullish(),
  order: z.array(orderingSchema).nullish(),
  limit: z.number().nullish(),
  offset: z.number().nullish(),
  distinct: z.boolean().nullish(),
  reduced: z.boolean().nullish(),
});

export type Term = z.infer<typeof termSchema>;
export type Triple = z.infer<typeof tripleSchema>;
export type BgpPattern = z.infer<typeof bgpPatternSchema>;
export type Pattern = z.infer<typeof patternSchema>;
export type SelectQueryJson = z.infer<typeof selectQuerySchema>;
