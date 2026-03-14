interface Node {
  col: number;
  row: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

export class PathfindingSystem {
  private collisions: boolean[][];
  private cols: number;
  private rows: number;

  constructor(collisions: boolean[][], cols: number, rows: number) {
    this.collisions = collisions;
    this.cols = cols;
    this.rows = rows;
  }

  findPath(
    startCol: number,
    startRow: number,
    endCol: number,
    endRow: number,
  ): { col: number; row: number }[] {
    const sc = Math.round(startCol);
    const sr = Math.round(startRow);
    const ec = Math.round(endCol);
    const er = Math.round(endRow);

    if (!this.isWalkable(ec, er)) return [];
    if (sc === ec && sr === er) return [];

    const open: Node[] = [];
    const closed = new Set<string>();
    const key = (c: number, r: number) => `${c},${r}`;

    const startNode: Node = { col: sc, row: sr, g: 0, h: this.heuristic(sc, sr, ec, er), f: 0, parent: null };
    startNode.f = startNode.g + startNode.h;
    open.push(startNode);

    const dirs = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ];

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;

      if (current.col === ec && current.row === er) {
        return this.buildPath(current);
      }

      closed.add(key(current.col, current.row));

      for (const [dc, dr] of dirs) {
        const nc = current.col + dc;
        const nr = current.row + dr;

        if (!this.isWalkable(nc, nr) || closed.has(key(nc, nr))) continue;

        // Prevent diagonal movement through walls
        if (dc !== 0 && dr !== 0) {
          if (!this.isWalkable(current.col + dc, current.row) ||
              !this.isWalkable(current.col, current.row + dr)) {
            continue;
          }
        }

        const moveCost = dc !== 0 && dr !== 0 ? 1.414 : 1;
        const g = current.g + moveCost;
        const existing = open.find(n => n.col === nc && n.row === nr);

        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = g + existing.h;
            existing.parent = current;
          }
        } else {
          const h = this.heuristic(nc, nr, ec, er);
          open.push({ col: nc, row: nr, g, h, f: g + h, parent: current });
        }
      }
    }

    return [];
  }

  private isWalkable(col: number, row: number): boolean {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.collisions[row][col];
  }

  private heuristic(c1: number, r1: number, c2: number, r2: number): number {
    return Math.abs(c1 - c2) + Math.abs(r1 - r2);
  }

  private buildPath(node: Node): { col: number; row: number }[] {
    const path: { col: number; row: number }[] = [];
    let current: Node | null = node;
    while (current) {
      path.unshift({ col: current.col, row: current.row });
      current = current.parent;
    }
    path.shift(); // Remove start position
    return path;
  }
}
