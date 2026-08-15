const DATABASE_NAME = "polygon-modeler";
const STORE_NAME = "projects";
const AUTOSAVE_KEY = "autosave";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("このブラウザではIndexedDBを利用できません"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("保存に失敗しました"));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("保存に失敗しました"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function saveAutosave(source: string): Promise<void> {
  await transact("readwrite", (store) => store.put(source, AUTOSAVE_KEY));
}

export async function loadAutosave(): Promise<string | undefined> {
  return transact("readonly", (store) => store.get(AUTOSAVE_KEY));
}

export async function clearAutosave(): Promise<void> {
  await transact("readwrite", (store) => store.delete(AUTOSAVE_KEY));
}
