// TODO(you): implement an LRU cache backed by a hashmap + doubly-linked list.
// All operations — get, put, has, size — must run in O(1).
// The cache starts empty. put() on a new key when at capacity must evict the
// least-recently-used entry. Both get() and put()-on-existing-key refresh recency.
export class LRUCache<K, V> {
  constructor(capacity: number) {
    // TODO: store capacity; initialise the hashmap and sentinel head/tail nodes.
    void capacity;
  }
  get(key: K): V | undefined {
    void key;
    return undefined; // TODO: return value and move to MRU head, or undefined if absent.
  }
  put(key: K, value: V): void {
    void key; void value;
    // TODO: insert or update. On update, refresh recency. On new key at capacity, evict LRU tail.
  }
  has(key: K): boolean {
    void key;
    return false; // TODO
  }
  get size(): number {
    return 0; // TODO: number of live entries (not counting sentinels).
  }
}
