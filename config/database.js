import mongoose from '../lib/mongoose-shim.js';

export async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('MONGO_URI not set; skipping MongoDB connection');
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}
