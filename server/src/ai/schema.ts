import { z } from 'zod'

type JsonObject = Record<string, unknown>

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Keywords whose value is a map of name to sub-schema, or a list of sub-schemas, or one sub-schema.
const SCHEMA_MAPS = ['properties', '$defs'] as const
const SCHEMA_LISTS = ['anyOf', 'oneOf', 'prefixItems'] as const
const SCHEMA_SINGLES = ['items', 'additionalProperties'] as const

function mapValues(map: JsonObject, visit: (schema: unknown) => unknown): JsonObject {
  return Object.fromEntries(Object.entries(map).map(([name, schema]) => [name, visit(schema)]))
}

// Copies a schema and adds the non-standard propertyOrdering (the property names in declaration
// order) to every object schema in it. Gemini generates fields in that order.
function withPropertyOrdering(schema: unknown): unknown {
  if (!isJsonObject(schema)) return schema
  const copy: JsonObject = { ...schema }
  for (const key of SCHEMA_MAPS) {
    const value = copy[key]
    if (isJsonObject(value)) copy[key] = mapValues(value, withPropertyOrdering)
  }
  for (const key of SCHEMA_LISTS) {
    const value = copy[key]
    if (Array.isArray(value)) copy[key] = value.map(withPropertyOrdering)
  }
  for (const key of SCHEMA_SINGLES) {
    const value = copy[key]
    if (isJsonObject(value)) copy[key] = withPropertyOrdering(value)
  }
  const properties = copy.properties
  if (isJsonObject(properties)) copy.propertyOrdering = Object.keys(properties)
  return copy
}

// Turns a Zod schema into the JSON Schema sent as `responseJsonSchema`. It does not remove
// keywords Gemini does not document (string length bounds, defaults, patterns): the model-output
// schemas are authored without them, and schema.test.ts walks the result and fails if one
// appears. Strict bounds are enforced afterwards by parsing the answer with the Zod schema.
export function toGeminiSchema(schema: z.ZodType): unknown {
  const converted: JsonObject = { ...z.toJSONSchema(schema, { target: 'draft-7' }) }
  delete converted.$schema
  return withPropertyOrdering(converted)
}
