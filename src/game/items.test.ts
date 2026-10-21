import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../content';
import { QUESTS } from '../content/quests';
import { validateContent } from '../content/validate';
import { renderCampaign } from '../ui/campaignView';
import { renderJournal } from '../ui/journalView';
import type { UIState } from '../ui/shared';
import { unitLabel } from './battle';
import { advanceMonth, newGame } from './campaign';
import { hasPassage, relationWith } from './diplomacy';
import { discardItem, discardQuote, heldQty, sellItem, sellQuote, useItem, useQuote } from './items';
import { chooseQuest, questQuote } from './quests';
import { parseSave } from './saves';
import type { Battle, GameState, QuestDefinition, Troop } from './types';
import { heroMaxHp } from './units';
import { townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

/** Fixture: a supply cache at Millbrook that hands out draughts. */
const CACHE: QuestDefinition = {
  id: 'TEST-CACHE',
  campaignIds: ['valley-quickplay'],
  kind: 'side',
  name: 'The Miller’s Cellar',
  giver: 'Millbrook Miller',
  at: 'millbrook',
  summary: 'The miller offers you his cellar stores.',
  prerequisites: [],
  needsEnvoy: false,
  stages: [{ id: 'offer', text: 'Take them?', choices: [{ id: 'take', label: 'Take the stores', then: {
    status: 'succeeded', journal: 'You took the stores.',
    effects: [{ kind: 'item', item: 'healing-draught', qty: 2 }, { kind: 'item', item: 'mana-draught' }],
  } }] }],
  onLocationLost: { status: 'superseded', effects: [], journal: 'Lost.' },
};

/** Fixture: present the Fenwick Charter as proof; the quest keeps it on record. */
const PROOF: QuestDefinition = {
  ...CACHE,
  id: 'TEST-PROOF',
  name: 'Proof of Friendship',
  stages: [{ id: 'present', text: 'Show your charter.', choices: [
    { id: 'show', label: 'Show the charter', requires: ['fenwick-charter'], then: { status: 'succeeded', effects: [{ kind: 'archive', item: 'fenwick-charter' }], journal: 'Shown.' } },
    { id: 'leave', label: 'Leave', then: { status: 'failed', effects: [], journal: 'Left.' } },
  ] }],
};

beforeEach(() => {
  QUESTS[CACHE.id] = CACHE;
  QUESTS[PROOF.id] = PROOF;
});
afterEach(() => {
  delete QUESTS[CACHE.id];
  delete QUESTS[PROOF.id];
});

function reload(s: GameState): GameState {
  return parseSave(JSON.stringify(s));
}

/** A valley game with the cellar stores taken and the lord wounded. */
function stocked(): { s: GameState; lord: Troop } {
  const s = newGame(1);
  expect(chooseQuest(s, CACHE.id, 'take')).toBeNull();
  const lord = s.armies.flatMap((a) => a.troops).find((t) => t.type === 'lord')!;
  lord.men = heroMaxHp('lord', lord.xp) - 5;
  return { s, lord };
}

describe('faction registry and relations', () => {
  it('says how each town stands toward you', () => {
    const s = newGame(1);
    expect(relationWith(s, 'aldenhold')).toBe('self');
    expect(relationWith(s, 'fenwick')).toBe('neutral');
    s.towns.harrowgate.owner = 'orcs';
    expect(relationWith(s, 'harrowgate')).toBe('hostile');
    expect(relationWith(s, 'nowhere')).toBeNull();
    chooseQuest(s, 'Q00', 'sign');
    expect(relationWith(s, 'fenwick')).toBe('ally');
    expect(hasPassage(s, 'player', 'fenwick')).toBe(true);
    expect(hasPassage(s, 'orcs', 'fenwick')).toBe(false);
  });

  it('a vassal that grants passage lets your armies through; a truce does not', () => {
    const s = newGame(1);
    s.treaties.fenwick = { relation: 'vassal', passage: true, signedTurn: 1 };
    expect(hasPassage(s, 'player', 'fenwick')).toBe(true);
    s.treaties.fenwick = { relation: 'truce', passage: false, signedTurn: 1 };
    expect(hasPassage(s, 'player', 'fenwick')).toBe(false);
  });

  it('labels troops and towns from the registry', () => {
    const b = { owners: { attacker: 'player', defender: 'orcs' } } as unknown as Battle;
    expect(unitLabel(b, { side: 'defender', type: 'warband' } as Battle['units'][number])).toBe('Enemy Orc Warband');
    expect(unitLabel(b, { side: 'attacker', type: 'archers' } as Battle['units'][number])).toBe('Your Archers');
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    expect(renderCampaign(s, ui('fenwick'))).toContain('Town · Free town · Allied');
  });

  it('content validation rejects unknown owners and a missing player faction', () => {
    const copy = structuredClone(CATALOG);
    copy.campaigns['valley-quickplay'].towns[0].owner = 'elves' as never;
    copy.factions.player.kind = 'free';
    const errors = validateContent(copy).join('\n');
    expect(errors).toMatch(/town aldenhold has unknown owner "elves"/);
    expect(errors).toMatch(/exactly one player faction/);
  });
});

describe('consumables', () => {
  it('a quest grants them in quantity; using one heals up to the maximum and subtracts exactly one', () => {
    let { s, lord } = stocked();
    expect(heldQty(s, 'healing-draught')).toBe(2);
    expect(useQuote(s, 'healing-draught', lord.id)).toEqual({ hp: 5, mana: 0, reason: null });
    expect(useItem(s, 'healing-draught', lord.id)).toBeNull();
    expect(lord.men).toBe(heroMaxHp('lord', lord.xp));
    expect(s.items['healing-draught']).toEqual({ qty: 1, spent: 1, archived: false });
    s = reload(s);
    lord = s.armies.flatMap((a) => a.troops).find((t) => t.type === 'lord')!;
    // A hero at full health gains nothing, so the flask is not wasted.
    expect(useItem(s, 'healing-draught', lord.id)).toBe('Aldric would gain nothing from it.');
    expect(heldQty(s, 'healing-draught')).toBe(1);
    // The lord has no mana, so a mana draught does nothing for him either.
    expect(useQuote(s, 'mana-draught', lord.id).reason).toMatch(/gain nothing/);
  });

  it('can only be used between battles, on one of your heroes', () => {
    const { s, lord } = stocked();
    const footman = s.armies.flatMap((a) => a.troops).find((t) => t.type === 'militia')!;
    expect(useQuote(s, 'healing-draught', footman.id).reason).toBe('Choose one of your heroes.');
    s.battle = {} as Battle;
    expect(useQuote(s, 'healing-draught', lord.id).reason).toBe('Use it between battles.');
  });

  it('sells for its value through the ledger, and the month reconciles', () => {
    const { s } = stocked();
    const gold = s.gold;
    expect(sellQuote(s, 'mana-draught')).toEqual({ gold: 50, reason: null });
    expect(sellItem(s, 'mana-draught')).toBeNull();
    expect(s.gold).toBe(gold + 50);
    expect(sellQuote(s, 'mana-draught').reason).toBe('You do not have that.');
    const report = advanceMonth(s)!;
    expect(report.ledger!.entries.some((e) => e.category === 'item-sale' && e.amount === 50)).toBe(true);
    expect(report.ledger!.entries.some((e) => e.category === 'balance-correction')).toBe(false);
    expect(discardItem(s, 'healing-draught')).toBeNull();
    expect(s.items['healing-draught']).toEqual({ qty: 1, spent: 1, archived: false });
    expect(reload(s).items['mana-draught']).toEqual({ qty: 0, spent: 1, archived: false });
  });

  it('save validation rejects forged counts and objects spent against their policy', () => {
    const { s } = stocked();
    const forged = structuredClone(s);
    forged.items['healing-draught'].qty = 5;
    expect(() => reload(forged)).toThrow(/inventory count/);
    chooseQuest(s, 'Q00', 'sign');
    const spentCharter = structuredClone(s);
    spentCharter.items['fenwick-charter'] = { qty: 0, spent: 1, archived: false };
    expect(() => reload(spentCharter)).toThrow(/cannot be spent/);
  });

  it('the journal offers each allowed action with its quote', () => {
    const { s } = stocked();
    const html = renderJournal(s);
    expect(html).toContain('Healing Draught</b> ×2');
    expect(html).toMatch(/data-action="use-item" data-item="healing-draught" data-troop="\d+"\s*>Give to Aldric \(\+5 HP\)/);
    expect(html).toContain('data-action="sell-item" data-item="healing-draught"');
  });
});

describe('evidence', () => {
  it('cannot be sold or thrown away', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    expect(sellQuote(s, 'fenwick-charter').reason).toBe('The Sealed Fenwick Charter cannot be sold.');
    expect(discardQuote(s, 'fenwick-charter').reason).toBe('The Sealed Fenwick Charter cannot be thrown away.');
    expect(renderJournal(s)).not.toContain('data-action="sell-item" data-item="fenwick-charter"');
  });

  it('a quest stage can require it, and presenting it archives it on the record', () => {
    let s = newGame(1);
    expect(questQuote(s, PROOF.id, 'show').reason).toBe('You need the Sealed Fenwick Charter.');
    expect(questQuote(s, PROOF.id, 'leave').reason).toBeNull();
    chooseQuest(s, 'Q00', 'sign');
    expect(chooseQuest(s, PROOF.id, 'show')).toBeNull();
    expect(s.items['fenwick-charter']).toEqual({ qty: 1, spent: 0, archived: true });
    expect(heldQty(s, 'fenwick-charter')).toBe(0);
    s = reload(s);
    expect(renderJournal(s)).toContain('Archived evidence');
    const unarchived = structuredClone(s);
    unarchived.items['fenwick-charter'].archived = false;
    expect(() => reload(unarchived)).toThrow(/archived evidence/);
  });
});

describe('item content validation', () => {
  const check = (edit: (c: typeof CATALOG) => void) => {
    const copy = structuredClone(CATALOG);
    edit(copy);
    return validateContent(copy).join('\n');
  };

  it('enforces policies by kind', () => {
    expect(check((c) => (c.items['fenwick-charter'].policy.sell = true))).toMatch(/evidence cannot be sellable/);
    expect(check((c) => delete c.items['healing-draught'].use)).toMatch(/every consumable needs one/);
    expect(check((c) => (c.items['healing-draught'].value = 0))).toMatch(/sellable but has no value/);
    expect(check((c) => (c.quests[PROOF.id].stages[0].choices[0].then = { status: 'succeeded', effects: [{ kind: 'archive', item: 'healing-draught' }], journal: '' })))
      .toMatch(/can only archive evidence/);
    expect(check((c) => (c.quests[PROOF.id].stages[0].choices[0].requires = ['crown']))).toMatch(/requires unknown item "crown"/);
    expect(check((c) => (c.quests[CACHE.id].stages[0].choices[0].then = { status: 'succeeded', effects: [{ kind: 'item', item: 'fenwick-charter', qty: 2 }], journal: '' })))
      .toMatch(/only consumables can be granted more than one/);
  });
});

describe('save migration v11 → v12', () => {
  it('turns the inventory list into counted holdings', () => {
    const s = newGame(1);
    chooseQuest(s, 'Q00', 'sign');
    const v11 = JSON.parse(JSON.stringify(s));
    v11.version = 11;
    v11.items = ['fenwick-charter'];
    const restored = parseSave(JSON.stringify(v11));
    expect(restored.version).toBe(15);
    expect(restored.items).toEqual({ 'fenwick-charter': { qty: 1, spent: 0, archived: false } });
    expect(townLocation(restored, 'fenwick')).toBe('fenwick');
  });
});
