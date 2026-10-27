/**
 * storage.js
 * ----------------------------------------------------------------
 * Generic Local Storage data access layer for Fleet Ledger.
 *
 * ARCHITECTURAL NOTE:
 * Every other module (auth.js, drivers.js, vehicles.js, etc.) must
 * read/write application data ONLY through this module — never call
 * window.localStorage directly elsewhere in the codebase.
 *
 * This indirection is what allows Local Storage to be swapped for a
 * MySQL-backed API later without touching any UI or feature logic:
 * only the function bodies in this file would change (e.g. from
 * localStorage.getItem to a fetch() call), while every caller's
 * function signature (getCollection, saveCollection, etc.) stays
 * identical.
 * ----------------------------------------------------------------
 */

const STORAGE_PREFIX = 'flms_';

/**
 * Builds the namespaced Local Storage key for a given collection name.
 * @param {string} collectionName - e.g. "users", "drivers", "vehicles"
 * @returns {string}
 */
function buildStorageKey(collectionName) {
  return `${STORAGE_PREFIX}${collectionName}`;
}

/**
 * Retrieves an entire collection (array of records) from Local Storage.
 * Returns an empty array if the collection does not exist yet.
 * @param {string} collectionName
 * @returns {Array<Object>}
 */
function getCollection(collectionName) {
  const raw = window.localStorage.getItem(buildStorageKey(collectionName));

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`storage.js: Failed to parse collection "${collectionName}"`, error);
    return [];
  }
}

/**
 * Overwrites an entire collection in Local Storage with a new array.
 * @param {string} collectionName
 * @param {Array<Object>} records
 */
function saveCollection(collectionName, records) {
  window.localStorage.setItem(buildStorageKey(collectionName), JSON.stringify(records));
}

/**
 * Appends a single record to an existing collection.
 * @param {string} collectionName
 * @param {Object} record
 */
function addRecord(collectionName, record) {
  const collection = getCollection(collectionName);
  collection.push(record);
  saveCollection(collectionName, collection);
}

/**
 * Finds the first record in a collection matching a predicate function.
 * @param {string} collectionName
 * @param {(record: Object) => boolean} predicate
 * @returns {Object|undefined}
 */
function findRecord(collectionName, predicate) {
  return getCollection(collectionName).find(predicate);
}

/**
 * Checks whether a given collection currently exists in Local Storage
 * (as opposed to simply being empty). Useful for one-time seed logic.
 * @param {string} collectionName
 * @returns {boolean}
 */
function collectionExists(collectionName) {
  return window.localStorage.getItem(buildStorageKey(collectionName)) !== null;
}