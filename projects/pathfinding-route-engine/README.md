# Pathfinding Route Engine — starter

Implement `MinHeap<T>`, `parseGrid`, `bfs`, `dijkstra`, and `astar` in `src/pathfind.ts`.

    bun test

Grid format: `.` = open (weight 1), `#` = wall, `2`–`9` = weighted cell.
4-directional movement. Each search returns `{ path, cost, expanded }`.

When the suite is green, read the project rubric and push to the senior bar:
bidirectional search, tie-breaking, performance on large grids, jump-point search.
