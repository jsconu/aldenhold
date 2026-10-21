import { describe, expect, it } from 'vitest';
import { createBattle } from '../game/battle';
import { makeTroop, newGame } from '../game/campaign';
import type { Army } from '../game/types';
import { renderBattle } from './battleView';
import type { UIState } from './shared';

describe('aiming a spell', () => {
  it('keeps the prompt and the Cast button in the top bar, which stays in view', () => {
    const s = newGame(1, 'western-realm');
    const mine: Army = { id: 900, owner: 'player', at: 'x', from: null, troops: [makeTroop(s, 'mage', 'Ysolde')] };
    const foe: Army = { id: 901, owner: 'orcs', at: 'x', from: null, troops: [makeTroop(s, 'warband')] };
    s.armies.push(mine, foe);
    const b = createBattle('x', mine, foe, false, 5);
    for (const col of b.terrain) col.fill('plain');
    const mage = b.units.find((u) => u.type === 'mage')!;
    const orc = b.units.find((u) => u.type === 'warband')!;
    Object.assign(mage, { col: 4, row: 4 });
    Object.assign(orc, { col: 7, row: 4 });
    s.battle = b;
    const ui: UIState = { selected: null, checked: new Set(), battleUnit: mage.id, battleSpell: 'fireball', message: '', view: 'map' };
    const header = (html: string) => html.slice(0, html.indexOf('<main'));
    expect(header(renderBattle(s, ui))).toContain('Fireball: click a highlighted target.');
    const aimed = header(renderBattle(s, { ...ui, battleTarget: orc.id }));
    expect(aimed).toContain('Fireball on Enemy Orc Warband: 6 damage.');
    expect(aimed).toContain('data-action="spell-confirm"');
    expect(aimed).toContain('or click the target again');
  });
});
