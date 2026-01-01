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
  console.error('Unable to dynamically import mongoose. Ensure it is installed.');
  throw new Error('mongoose import failed');
}

const mongoose = await loadMongoose();
export default mongoose;
