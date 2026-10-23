import { cityBuildingName, type CityBuilding } from '../game/cityBattle';
import type { Battle } from '../game/types';
import { esc } from './shared';

/** Original SVG settlement art, in the same coordinates as the tactical pieces. */
export function cityBattleArt(b: Battle, center: (col: number, row: number) => [number, number]): string {
  if (!b.city) return '';
  const [wall] = center(16, 0), [, bottom] = center(16, b.height - 1);
  const gates = [9, 10, 11].map(row => {
    const [x, y] = center(16, row);
    return `<path d="M${x - 24} ${y}h48" stroke="#a99977" stroke-width="24"/><path d="M${x - 24} ${y}h48" stroke="#5b4c35" stroke-width="2" stroke-dasharray="3 6"/>`;
  }).join('');
  const walls = b.walls ? Array.from({ length: b.height }, (_, row) => {
    if (Math.abs(row - Math.floor(b.height / 2)) <= 1) return '';
    const [x, y] = center(16, row);
    return `<g fill="#847d6d" stroke="#373a34" stroke-width="2"><path d="M${x - 15} ${y - 26}h30v52h-30z"/><path d="M${x - 20} ${y - 27}h9v8h8v-8h9v8h8v-8h8v15h-42z" fill="#b1a991"/><path d="M${x - 15} ${y - 5}h30m-30 16h30m-15 -32v16m-7 0v16m14 -16v16" fill="none"/></g>`;
  }).join('') : '';
  return `<g class="city-battle-art" pointer-events="none"><rect x="${wall + 18}" y="0" width="${b.width * 45 - wall}" height="${bottom + 80}" fill="#988767" opacity=".7"/><path d="M${wall + 65} 0v${bottom + 80}M${wall + 110} 0v${bottom + 80}" stroke="#c3b28d" stroke-width="18" opacity=".4"/>${gates}${walls}${b.city.buildings.map(site => buildingArt(site, ...center(site.col, site.row))).join('')}</g>`;
}
function buildingArt(site: CityBuilding, x: number, y: number): string {
  const roof = site.kind === 'farm' ? '#bc974d' : site.kind === 'lumber' ? '#637445' : site.kind === 'mine' ? '#606e79' : site.kind === 'forge' ? '#a34f3d' : site.kind === 'treasury' ? '#75698d' : '#986748';
  const height = 14 + Math.min(4, site.level) * 3;
  if (site.pillaged) return `<g><title>${esc(cityBuildingName(site))}: pillaged</title><path d="M${x - 20} ${y - 3}l7 -10 8 7 6 -9 19 15z" fill="#544d45" stroke="#262b27"/><path d="M${x - 5} ${y - 12}q-9 -15 1 -28m8 25q9 -12 0 -25" stroke="#302d2b" stroke-width="4" opacity=".5" fill="none"/></g>`;
  return `<g><title>${esc(cityBuildingName(site))} level ${site.level}: defensive position</title><ellipse cx="${x}" cy="${y + 10}" rx="25" ry="13" fill="#32392b" opacity=".6"/><path d="M${x - 21} ${y - height}h42v${height + 12}h-42z" fill="#b4a383" stroke="#494a3c" stroke-width="2"/><path d="M${x - 25} ${y - height}l25 -16 25 16z" fill="${roof}" stroke="#3c3f33" stroke-width="2"/><path d="M${x - 15} ${y - height + 5}h7v8h-7zm22 0h7v8h-7z" fill="#514b3b"/>${site.kind === 'forge' ? `<path d="M${x + 13} ${y - height - 2}v-17h7v22" fill="#6a6661" stroke="#383b34"/>` : ''}<rect x="${x - 19}" y="${y + 19}" width="38" height="10" rx="2" fill="#282b24"/><text x="${x}" y="${y + 27}" text-anchor="middle" fill="#f1d795" font-size="8">${site.kind === 'treasury' ? 'GOLD' : site.kind.toUpperCase()} ${site.level}</text></g>`;
}
