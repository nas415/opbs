// Dynamic shim for mongoose to handle hosts with different package layouts.
// Attempts to import the package root, then falls back to common built paths.
let mongooseModule = null;
async function loadMongoose() {
  if (mongooseModule) return mongooseModule;
  const tries = ['mongoose', 'mongoose/dist/index.js', 'mongoose/index.js'];
  for (const p of tries) {
    try {
      const mod = await import(p);
      mongooseModule = mod.default || mod;
      return mongooseModule;
    } catch (e) {
      // continue
    }
  }

  // If mongoose isn't available, provide a harmless in-process mock that
  // allows the rest of the application to import model definitions without
  // crashing. The mock will no-op `connect` and provide lightweight
  // `Schema`/`model` stubs so code referencing models doesn't throw at import time.
  console.warn('mongoose package not found — database functionality will be disabled.');

  const models = Object.create(null);

  class MockSchema {
    constructor(definition = {}, options = {}) {
      this.definition = definition;
      this.options = options;
    }
  }

  class MockModel {
    constructor(doc = {}) {
      Object.assign(this, doc);
    }
    static async findOne() { return null; }
    static async find() { return []; }
    static async findById() { return null; }
    static async create() { throw new Error('mongoose not installed'); }
    save() { throw new Error('mongoose not installed'); }
  }

  mongooseModule = {
    Schema: MockSchema,
    model: (name, schema) => {
      if (!models[name]) models[name] = MockModel;
      return models[name];
    },
    models,
    Types: { ObjectId: class {} },
    connect: async () => {
      console.warn('Skipping MongoDB connection because mongoose is not installed.');
      return Promise.resolve();
    }
  };

  return mongooseModule;
}

const mongoose = await loadMongoose();
export default mongoose;
