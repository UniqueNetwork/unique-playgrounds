const EXAMPLE_SCHEMA = {
  nested: {
    onChainMetaData: {
      nested: {
        NFTMeta: {
          fields: {
            ipfsJson: {
              id: 1,
              rule: 'required',
              type: 'string'
            },
            gender: {
              id: 2,
              rule: 'required',
              type: 'Gender'
            },
            traits: {
              id: 3,
              rule: 'repeated',
              type: 'PunkTrait'
            },
          },
        },
        Gender: {
          options: {
            Female: '{"en": "Female"}',
            Male: '{"en": "Male"}'
          },
          values: {
            Female: 1,
            Male: 0,
          },
        },
        PunkTrait: {
          options: {
            SMILE: '{"en": "Smile"}',
            SUNGLASSES: '{"en": "Sunglasses"}',
            MUSTACHE: '{"en": "Mustache"}',
            BALD: '{"en": "Bald"}'
          },
          values: {
            SMILE: 0,
            SUNGLASSES: 1,
            MUSTACHE: 2,
            BALD: 3
          }
        }
      }
    }
  }
}

const EXAMPLE_SCHEMA_JSON = JSON.stringify(EXAMPLE_SCHEMA);

const ipfsJson = JSON.stringify({
  ipfs: "QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb",
  type: "image"
})

const EXAMPLE_DATA = {
  traits: [0, 2],
  ipfsJson,
  gender: 0
}

const EXAMPLE_DATA_JSON = JSON.stringify(EXAMPLE_DATA);

const EXAMPLE_DATA_HUMAN = {
  ipfsJson,
  gender: "Male",
  traits: [
    "SMILE",
    "MUSTACHE"
  ]
}

const EXAMPLE_DATA_BINARY = '0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020002';

module.exports = {
  EXAMPLE_SCHEMA, EXAMPLE_SCHEMA_JSON,
  EXAMPLE_DATA, EXAMPLE_DATA_JSON, EXAMPLE_DATA_HUMAN, EXAMPLE_DATA_BINARY
}
