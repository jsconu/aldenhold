import type { Battle } from '../game/types';

/** Continuous environmental accents, painted below interactive units.
 *  Terrain classifications and click targets remain separate from the art. */
const R = 30;
const H = Math.sqrt(3) * R;
const PAD = 6;
function center(col: number, row: number): [number, number] {
  return [PAD + R + col * 1.5 * R, PAD + H / 2 + H * (row + 0.5 * (col & 1))];
}
function noise(x: number, y: number, salt: number): number {
  const seed = Math.imul(x + salt * 83, 374761393) ^ Math.imul(y + 91, 668265263);
  const mixed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}
function connections(b: Battle, terrain: string, style: string): string {
  const result: string[] = [];
  for (let col = 0; col < b.width; col++) for (let row = 0; row < b.height; row++) {
    if (b.terrain[col][row] !== terrain) continue;
    const [cx, cy] = center(col, row);
    // Check only columns to the east. For a flat-top odd-q layout,
    // this catches two diagonals and prevents duplicated connectors.
    for (const nextRow of [row + (col & 1 ? 0 : -1), row + (col & 1 ? 1 : 0)]) {
      if (col + 1 >= b.width || nextRow < 0 || nextRow >= b.height ||
        b.terrain[col + 1][nextRow] !== terrain) continue;
      const [nx, ny] = center(col + 1, nextRow);
      const drift = (noise(col, row, nextRow + 1) - .5) * 18;
      const d = `M${cx.toFixed(1)} ${cy.toFixed(1)} Q${((cx + nx) / 2).toFixed(1)}
        ${((cy + ny) / 2 + drift).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      result.push(`<path d="${d}" class="${style}"/>`);
    }
  }
  return result.join('');
}

/** Deterministic, organic scenery which crosses cells without showing a lattice. */
export function battleScenery(b: Battle): string {
  const streams = connections(b, 'stream', 'battle-water-ribbon');
  const woods = connections(b, 'forest', 'battle-woodland-shade');
  const rollingHills = connections(b, 'hill', 'battle-ridge-shade');
  const accents: string[] = [];
  for (let col = 0; col < b.width; col++) for (let row = 0; row < b.height; row++) {
    const type = b.terrain[col][row];
    const [cx, cy] = center(col, row);
    const dx = (noise(col, row, 37) - .5) * 30, dy = (noise(col, row, 41) - .5) * 24;
    const x = cx + dx, y = cy + dy;
    const n = noise(col, row, 17);
    if (type === 'stream') {
      accents.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="21" ry="14" class="battle-water-pool"/>`);
      if (n > .43) accents.push(`<path d="M${x - 9} ${y}q4 -3 8 0t8 0" class="battle-water-ripple"/>`);
    } else if ((type === 'plain' || type === 'hill') && n > .22) {
      accents.push(`<path d="M${x.toFixed(1)} ${(y + 6).toFixed(1)}l-3 -5
        m3 5l1 -7 m0 7l5 -5" class="battle-wild-grass"/>`);
      if (n > .92) accents.push(`<circle cx="${(x + 5).toFixed(1)}" cy="${(y - 6).toFixed(1)}" r="1.7" class="battle-wildflower"/>`);
    } else if (type === 'forest' && n > .63) {
      accents.push(`<ellipse cx="${x.toFixed(1)}" cy="${(y + 9).toFixed(1)}" rx="15" ry="5" class="battle-forest-shadow"/>`);
    } else if ((type === 'rocks' || type === 'ruins') && n > .3) {
      accents.push(`<path d="M${x - 10} ${y + 9}l6 -2 5 2 5 -1 6 3" class="battle-scree"/>`);
    }
  }
  // Connectors below local stamped trees; streams above the terrain wash.
  return `<g class="battle-landscape-scenery" pointer-events="none">
    <g class="battle-woods">${woods}${rollingHills}</g>
    <g class="battle-creeks">${streams}</g>
    <g class="battle-accents">${accents.join('')}</g>
  </g>`;
}
