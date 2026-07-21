import type { DrumPattern } from '../../models/pattern'

const DATABASE_NAME = 'sr16-studio'
const DATABASE_VERSION = 1
const STORE_NAME = 'patterns'

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Could not open the local pattern library.', { cause: request.error }))
})

const runRequest = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('The pattern library operation failed.', { cause: request.error }))
    })
  } finally {
    database.close()
  }
}

export const listPatterns = async (): Promise<DrumPattern[]> => {
  const patterns = await runRequest<DrumPattern[]>('readonly', (store) => store.getAll())
  return patterns.sort((a, b) => b.createdAt - a.createdAt)
}

export const savePattern = async (pattern: DrumPattern): Promise<void> => {
  await runRequest<IDBValidKey>('readwrite', (store) => store.put(pattern))
}

export const deletePattern = async (id: string): Promise<void> => {
  await runRequest<undefined>('readwrite', (store) => store.delete(id))
}
