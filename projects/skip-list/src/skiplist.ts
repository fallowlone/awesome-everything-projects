// TODO(you): implement a skip list with an injected, deterministic coin flip.
//
// UNIT: SkipList(coinFlip: () => boolean, maxLevel?: number)
//   coinFlip() → true means "promote to next level", false means "stop".
//   Never call Math.random() — the coinFlip parameter is the only source of
//   randomness. This keeps the structure fully deterministic and unit-testable.
//
// METHODS:
//   insert(k: number): void   — insert key k; ignore if already present
//   has(k: number): boolean   — return true iff k is in the list
//   delete(k: number): boolean — remove k; return true if found, false if absent
//   toArray(): number[]        — return all keys in ascending order
//
// HINTS:
//   • Use two sentinel nodes (head key = -Infinity, tail key = +Infinity) so
//     every level is a complete chain and boundary checks are pointer comparisons.
//   • Build an update[] vector during traversal (last node visited at each level)
//     so insert and delete can splice in O(height) without a second pass.
//   • Maintain currentLevel (the highest non-empty level) and decrement it after
//     a delete that empties the top level.

export class SkipList {
  constructor(coinFlip: () => boolean, maxLevel = 16) {
    // TODO: store coinFlip, maxLevel; create head and tail sentinels; set currentLevel = 1.
    void coinFlip; void maxLevel;
  }

  insert(_k: number): void {
    // TODO: walk the update vector from currentLevel down to 0;
    // generate a random level for the new node using coinFlip;
    // splice the new node into every level up to its generated height.
  }

  has(_k: number): boolean {
    // TODO: descend from currentLevel; advance while next key < k; drop a level.
    // At level 0, check whether the next node's key === k.
    return false;
  }

  delete(_k: number): boolean {
    // TODO: walk the update vector; check update[0].forward[0].key === k;
    // if absent return false; otherwise unlink from every level and decrement
    // currentLevel if the top level is now empty.
    return false;
  }

  toArray(): number[] {
    // TODO: linear walk of the level-0 chain from head.forward[0] to tail;
    // collect and return keys.
    return [];
  }
}
