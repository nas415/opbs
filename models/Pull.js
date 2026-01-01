import mongoose from "../lib/mongoose-shim.js";

const PullSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  window: { type: Number, required: true },
  used: { type: Number, default: 0 },
  // total pulls ever (used for pity / 100-cycle)
  totalPulls: { type: Number, default: 0 },
});

// Compound unique index on userId and window
PullSchema.index({ userId: 1, window: 1 }, { unique: true });

// Drop old index if exists
PullSchema.post('init', async function() {
  try {
    await this.collection.dropIndex('userId_1');
    console.log('Dropped old userId index from pulls collection');
  } catch (e) {
    // Index doesn't exist or already dropped
  }
});

export default mongoose.models.Pull || mongoose.model("Pull", PullSchema);
