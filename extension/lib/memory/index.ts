export {
  loadEmbeddingModel,
  isModelReady,
  generateEmbedding,
  type ProgressCallback,
} from "./embeddings";

export {
  getUserProfile,
  updateUserProfile,
  addProfileFact,
  addProfilePreference,
  addMemory,
  searchMemories,
  getRecentMemories,
  getMemoryCount,
  pruneMemories,
  clearAllMemories,
  buildMemoryContext,
  type UserProfile,
  type MemoryEntry,
  type MemorySearchResult,
} from "./store";

export { summarizeSession } from "./session-summary";
