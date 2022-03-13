const { UniqueSchemaHelper } = require('../src/lib/unique');
const { EXAMPLE_SCHEMA, EXAMPLE_SCHEMA_JSON, EXAMPLE_DATA, EXAMPLE_DATA_HUMAN, EXAMPLE_DATA_BINARY } = require('./misc/schema.data');

describe('UniqueSchemaHelper tests', () => {
  let schemaHelper;

  beforeAll(() => {
    schemaHelper = new UniqueSchemaHelper();
  });

  it('Test decodeSchema', () => {
    let schema = schemaHelper.decodeSchema(EXAMPLE_SCHEMA_JSON);
    expect(schema.json).toEqual(EXAMPLE_SCHEMA);
    expect(schema.NFTMeta).not.toBeUndefined();
    expect(schema.NFTMeta).not.toBeNull();
  });

  it('Test decodeData', () => {
    let data = schemaHelper.decodeData(EXAMPLE_SCHEMA_JSON, EXAMPLE_DATA_BINARY);
    expect(data.data).toEqual(EXAMPLE_DATA);
    expect(data.human).toEqual(EXAMPLE_DATA_HUMAN);
  });

  it('Test encodeData', () => {
    let data = schemaHelper.encodeData(EXAMPLE_SCHEMA_JSON, EXAMPLE_DATA);
    expect(data).toEqual(EXAMPLE_DATA_BINARY);
  });
})
