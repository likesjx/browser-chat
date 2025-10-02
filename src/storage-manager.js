/**
 * Storage Manager - IndexedDB operations for conversation history
 *
 * Handles persistent storage of conversation pairs with embeddings for vector search.
 * Implements validation, error handling, and quota management per data-model.md.
 */

const DB_NAME = 'chat-component-db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

/**
 * Initialize IndexedDB database and create object stores
 * @returns {Promise<IDBDatabase>} Opened database connection
 */
export async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    // Create object stores on first initialization or version upgrade
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create conversations store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Create index on timestamp for chronological queries
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });

        console.log(`Created object store: ${STORE_NAME} with timestamp index`);
      }
    };
  });
}

/**
 * Validate ConversationPair object before storage
 * @param {Object} conversationPair - Conversation pair to validate
 * @throws {Error} If validation fails
 */
function validateConversationPair(conversationPair) {
  // Required fields
  if (!conversationPair.id || typeof conversationPair.id !== 'number') {
    throw new Error('ConversationPair must have numeric id (timestamp)');
  }

  if (!conversationPair.prompt || typeof conversationPair.prompt !== 'string') {
    throw new Error('ConversationPair must have prompt string');
  }

  if (!conversationPair.response || typeof conversationPair.response !== 'string') {
    throw new Error('ConversationPair must have response string');
  }

  // Validate prompt length (1-10000 chars)
  const promptLength = conversationPair.prompt.trim().length;
  if (promptLength < 1 || promptLength > 10000) {
    throw new Error(`Prompt length must be 1-10000 characters, got ${promptLength}`);
  }

  // Validate response length (1-100000 chars)
  const responseLength = conversationPair.response.trim().length;
  if (responseLength < 1 || responseLength > 100000) {
    throw new Error(`Response length must be 1-100000 characters, got ${responseLength}`);
  }

  // Validate embedding if present (must be Float32Array with 384 dimensions)
  if (conversationPair.embedding) {
    if (!(conversationPair.embedding instanceof Float32Array)) {
      throw new Error('Embedding must be Float32Array');
    }
    if (conversationPair.embedding.length !== 384) {
      throw new Error(`Embedding must have 384 dimensions, got ${conversationPair.embedding.length}`);
    }
  }

  // Validate model version
  if (!conversationPair.modelVersion || typeof conversationPair.modelVersion !== 'string') {
    throw new Error('ConversationPair must have modelVersion string');
  }

  // Validate timestamp
  if (!(conversationPair.timestamp instanceof Date)) {
    throw new Error('ConversationPair must have timestamp as Date object');
  }

  // Timestamp must not be in the future
  if (conversationPair.timestamp.getTime() > Date.now()) {
    throw new Error('Timestamp cannot be in the future');
  }
}

/**
 * Save conversation pair to IndexedDB
 * @param {Object} conversationPair - Conversation pair to store
 * @param {number} conversationPair.id - Unique identifier (timestamp)
 * @param {string} conversationPair.prompt - User's input text
 * @param {string} conversationPair.response - Model's response
 * @param {Float32Array} [conversationPair.embedding] - Vector representation (384 dimensions)
 * @param {string} conversationPair.modelVersion - Model identifier
 * @param {Date} conversationPair.timestamp - Creation time
 * @returns {Promise<{success: boolean, error?: Error}>} Result with success flag
 */
export async function saveConversation(conversationPair) {
  try {
    // Validate before storing
    validateConversationPair(conversationPair);

    const db = await initDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(conversationPair);

      request.onsuccess = () => {
        resolve({ success: true });
      };

      request.onerror = () => {
        // Check for QuotaExceededError per FR-017
        if (request.error.name === 'QuotaExceededError') {
          const quotaError = new Error(
            'Storage quota exceeded. Clear history to continue saving conversations.'
          );
          quotaError.name = 'QuotaExceededError';
          resolve({ success: false, error: quotaError });
        } else {
          resolve({
            success: false,
            error: new Error(`Failed to save conversation: ${request.error}`)
          });
        }
      };

      transaction.onerror = () => {
        resolve({
          success: false,
          error: new Error(`Transaction failed: ${transaction.error}`)
        });
      };
    });
  } catch (error) {
    // Return validation errors
    return { success: false, error };
  }
}

/**
 * Retrieve recent conversation history
 * @param {number} limit - Maximum number of conversations to retrieve (default 10)
 * @returns {Promise<Array>} Array of conversation objects (without embeddings)
 */
export async function getHistory(limit = 10) {
  try {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('timestamp');

      // Get all conversations in descending order (newest first)
      const request = index.openCursor(null, 'prev');
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && results.length < limit) {
          const conversation = cursor.value;

          // Exclude embedding from results (too large for general retrieval)
          const { embedding, ...conversationWithoutEmbedding } = conversation;
          results.push(conversationWithoutEmbedding);

          cursor.continue();
        } else {
          // Reached limit or end of data
          resolve(results);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve history: ${request.error}`));
      };
    });
  } catch (error) {
    throw new Error(`Failed to get history: ${error.message}`);
  }
}

/**
 * Delete all conversation records from storage
 * @returns {Promise<{count: number}>} Number of records deleted
 */
export async function clearHistory() {
  try {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      // First count records before clearing
      const countRequest = objectStore.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;

        // Now clear the store
        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
          resolve({ count });
        };

        clearRequest.onerror = () => {
          reject(new Error(`Failed to clear history: ${clearRequest.error}`));
        };
      };

      countRequest.onerror = () => {
        reject(new Error(`Failed to count records: ${countRequest.error}`));
      };
    });
  } catch (error) {
    throw new Error(`Failed to clear history: ${error.message}`);
  }
}

/**
 * Get total number of stored conversation pairs
 * @returns {Promise<number>} Count of conversations
 */
export async function getConversationCount() {
  try {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to count conversations: ${request.error}`));
      };
    });
  } catch (error) {
    throw new Error(`Failed to get conversation count: ${error.message}`);
  }
}

/**
 * Close database connection
 * @param {IDBDatabase} db - Database to close
 */
export function closeDatabase(db) {
  if (db) {
    db.close();
  }
}
