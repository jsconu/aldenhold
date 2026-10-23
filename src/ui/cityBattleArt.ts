import { cityBuildingName, type CityBuilding } from '../game/cityBattle';
import type { Battle } from '../game/types';
import { richRuin } from './richBattle';
import { esc } from './shared';

const SPRITES: Record<CityBuilding['kind'], number> = { homes: 0, farm: 1, lumber: 2, mine: 3, forge: 4, treasury: 5 };
const LABELS = { farm: 'Farm', lumber: 'Camp', mine: 'Mine', forge: 'Forge', treasury: 'Gold' };

/** Quiet paving and soft stonework support detailed buildings without competing with troops. */
export function cityBattleArt(b: Battle, center: (col: number, row: number) => [number, number]): string {
  if (!b.city) return '';
  const [wall] = center(16, 0), [, bottom] = center(16, b.height - 1);
  const gates = [9, 10, 11].map(row => {
    const [x, y] = center(16, row);
    return `<path d="M${x - 27} ${y}h60" stroke="#b2a386" stroke-width="26"/><path d="M${x - 27} ${y}h60" stroke="url(#city-paving)" stroke-width="24"/>`;
  }).join('');
  const walls = b.walls ? Array.from({ length: b.height }, (_, row) => {
    if (Math.abs(row - Math.floor(b.height / 2)) <= 1) return '';
    const [x, y] = center(16, row);
    return `<g stroke="#626557" stroke-width=".65"><path d="M${x - 12} ${y - 27}h29v55h-29z" fill="url(#city-stone)"/><path d="M${x + 17} ${y - 27}l7 4v51h-7z" fill="#696d60"/><path d="M${x - 17} ${y - 28}h9v7h7v-7h9v7h7v-7h8v15h-40z" fill="#b8b9a4"/><path d="M${x - 12} ${y - 12}h29" stroke="#d3cbb3"/><path d="M${x + 1} ${y - 3}v12h3v-12z" fill="#424d42" stroke="none"/></g>`;
  }).join('') : '';
  return `<g class="city-battle-art" pointer-events="none"><defs>
    <pattern id="city-paving" patternUnits="userSpaceOnUse" width="24" height="16"><rect width="24" height="16" fill="#a8997a"/><path d="M0 8h24M12 0v8M5 8v8" stroke="#776f5d" stroke-width=".6" opacity=".24"/></pattern>
    <pattern id="city-stone" patternUnits="userSpaceOnUse" width="16" height="12"><rect width="16" height="12" fill="#929681"/><path d="M0 6h16M8 0v6M3 6v6" stroke="#626b5b" stroke-width=".65"/><path d="M1 1h6M9 7h6" stroke="#c4c0a7" stroke-width=".7" opacity=".65"/></pattern>
  </defs><rect x="${wall + 18}" y="0" width="${b.width * 45 - wall}" height="${bottom + 80}" fill="#8c886b" opacity=".72"/>
    <path d="M${wall + 65} 0v${bottom + 80}M${wall + 110} 0v${bottom + 80}" stroke="url(#city-paving)" stroke-width="22" opacity=".8"/>
    ${gates}${walls}${b.city.buildings.map(site => buildingArt(site, ...center(site.col, site.row))).join('')}</g>`;
}

function buildingArt(site: CityBuilding, x: number, y: number): string {
  const label = `${cityBuildingName(site)} level ${site.level}: ${site.pillaged ? 'pillaged' : 'defensive position'}`;
  if (site.pillaged) return `<g data-city-building="${site.kind}" data-pillaged="true"><title>${esc(label)}</title>${richRuin(x, y, site.col * 31 + site.row)}</g>`;
  const index = SPRITES[site.kind], size = 56 + Math.min(3, site.level - 1) * 2;
  // The viewport selects one transparent atlas cell without editing or resampling the asset.
  return `<g data-city-building="${site.kind}" data-level="${site.level}"><title>${esc(label)}</title>
    <svg x="${x - size / 2}" y="${y - size + 15}" width="${size}" height="${size}" viewBox="${index % 3} ${Math.floor(index / 3)} 1 1" preserveAspectRatio="xMidYMid meet"><image href="/assets/battle/city-buildings-v1.png" width="3" height="2" preserveAspectRatio="none"/></svg>
    ${site.kind === 'homes' ? '' : `<rect x="${x - 21}" y="${y + 17}" width="42" height="10" rx="3" fill="#242e25" opacity=".88"/><text x="${x}" y="${y + 24.5}" text-anchor="middle" fill="#e5d2a0" font-size="7.5">${LABELS[site.kind]} ${site.level}</text>`}</g>`;
}
