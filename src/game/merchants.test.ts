import { describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import type { UIState } from '../ui/shared';
import { advanceMonth, armyAt, neighborsOf, newGame } from './campaign';
import { heldQty, sellItem } from './items';
import { buyItem, buyQuote, merchantStatus } from './merchants';
import { advanceQuests, chooseQuest } from './quests';
import { parseSave } from './saves';
import type { GameState } from './types';
import { landAt, townLocation } from './world';
import { LAND } from '../content/rules';
import { MERRA } from '../content/merchants';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** Q05 offered (month 5) with your home army camped next to Fenwick, in trading range. */
function atFenwick(): GameState {
  const s = newGame(1, 'western-realm');
  s.turn = 5;
  advanceQuests(s);
  const fenwick = townLocation(s, 'fenwick');
  armyAt(s, townLocation(s, 'aldenhold'), 'player')!.at = neighborsOf(s, fenwick)
    .find((k) => Number.isFinite(LAND[landAt(s, k)].move) && !s.armies.some((a) => a.at === k))!;
  // Start the month with 1000 gold on the books, so the ledger stays reconciled.
  expect(s.treasury.pending).toEqual([]);
  s.gold = 1000;
  s.treasury.opening = 1000;
  return s;
}

/** Q05 ended by ransom: the only branch that needs no battle. */
function ransomed(): GameState {
  const s = atFenwick();
  expect(chooseQuest(s, 'Q05', 'ransom')).toBeNull();
  return s;
}

describe('Merra’s stall (Q05 follow-up)', () => {
  it('stays out of sight until the caravan’s fate is known', () => {
    const s = atFenwick();
    expect(merchantStatus(s, MERRA)).toBeNull();
    expect(renderCampaign(s, ui(townLocation(s, 'fenwick')))).not.toContain('Merra’s stall');
    expect(buyQuote(s, 'merra', 'healing-draught').reason).toBe('Not open.');
  });

  it('after a ransom she trades at half again the price, two draughts a month', () => {
    let s = ransomed();
    expect(merchantStatus(s, MERRA)).toMatchObject({ open: true, markup: 1.5 });
    expect(buyQuote(s, 'merra', 'healing-draught')).toEqual({ gold: 60, left: 2, reason: null });
    const gold = s.gold;
    expect(buyItem(s, 'merra', 'healing-draught')).toBeNull();
    expect(buyItem(s, 'merra', 'healing-draught')).toBeNull();
    expect(s.gold).toBe(gold - 120);
    expect(s.items['healing-draught']).toEqual({ qty: 2, spent: 0, archived: false, bought: 2 });
    expect(buyQuote(s, 'merra', 'healing-draught')).toMatchObject({ left: 0, reason: 'Sold out until next month.' });
    s = reload(s);
    expect(buyQuote(s, 'merra', 'healing-draught').reason).toBe('Sold out until next month.');
    // The purchases go through the ledger, and the month reconciles without a correction.
    const report = advanceMonth(s)!;
    expect(report.ledger!.entries.filter((e) => e.category === 'item-purchase').map((e) => e.amount)).toEqual([-60, -60]);
    expect(report.ledger!.entries.some((e) => e.category === 'balance-correction')).toBe(false);
    // New month, new stock.
    expect(buyQuote(s, 'merra', 'healing-draught').left).toBe(2);
  });

  it('a rescue earns list prices, and her stall shows in Fenwick', () => {
    const s = atFenwick();
    s.flags.push('caravan-rescued');
    expect(merchantStatus(s, MERRA)).toMatchObject({ open: true, markup: 1 });
    expect(buyQuote(s, 'merra', 'mana-draught')).toMatchObject({ gold: 50, left: 1 });
    const html = renderCampaign(s, ui(townLocation(s, 'fenwick')));
    expect(html).toContain('Merra trades with you at cost');
    expect(html).toMatch(/data-action="buy-item" data-merchant="merra" data-item="healing-draught"\s*>\s*Buy Healing Draught · 40g/);
  });

  it('a lost caravan leaves an empty stall, and nothing can be bought', () => {
    const s = atFenwick();
    s.flags.push('caravan-lost');
    expect(merchantStatus(s, MERRA)).toEqual({ open: false, note: 'Merra’s stall stands empty. Her caravan never came home.' });
    expect(renderCampaign(s, ui(townLocation(s, 'fenwick')))).toContain('Merra’s stall stands empty');
    expect(buyQuote(s, 'merra', 'healing-draught').reason).toBe('Merra’s stall stands empty. Her caravan never came home.');
  });

  it('needs an army nearby, and closes if Fenwick falls to the orcs', () => {
    const s = ransomed();
    s.armies.find((a) => a.owner === 'player' && a.troops.some((t) => t.type === 'lord'))!.at = townLocation(s, 'aldenhold');
    expect(buyQuote(s, 'merra', 'healing-draught').reason).toBe('Send an army to Fenwick or a neighbouring road to trade.');
    s.towns.fenwick.owner = 'orcs';
    expect(buyQuote(s, 'merra', 'healing-draught').reason).toBe('Fenwick is in orc hands; the stall is boarded up.');
  });

  it('bought draughts can be used, sold or thrown away like any others, and saves keep the balance', () => {
    const s = ransomed();
    buyItem(s, 'merra', 'healing-draught');
    expect(sellItem(s, 'healing-draught')).toBeNull();
    expect(s.items['healing-draught']).toEqual({ qty: 0, spent: 1, archived: false, bought: 1 });
    expect(() => reload(s)).not.toThrow();
    const forged = structuredClone(s);
    forged.items['healing-draught'].qty = 3;
    expect(() => reload(forged)).toThrow(/inventory count/);
    const unstocked = structuredClone(s);
    unstocked.items['old-watch-shield'] = { qty: 1, spent: 0, archived: false, bought: 1 };
    expect(() => reload(unstocked)).toThrow(/bought objects/);
    expect(heldQty(s, 'healing-draught')).toBe(0);
  });

  it('content validation checks the stall', () => {
    const check = (edit: (c: typeof CATALOG) => void) => {
      const copy = structuredClone(CATALOG);
      edit(copy);
      return validateContent(copy).join('\n');
    };
    expect(validateContent(CATALOG)).toEqual([]);
    expect(check((c) => (c.merchants.merra.stock[0].item = 'oathlance'))).toMatch(/"oathlance" is not a tradable good/);
    expect(check((c) => (c.merchants.merra.at = 'atlantis'))).toMatch(/town "atlantis" is not in the quest's campaigns/);
    expect(check((c) => (c.merchants.merra.terms[0].markup = 0.5))).toMatch(/markup of at least 1/);
  });
});
