import { describe, expect, it } from 'vitest';
import { renderCampaign } from '../ui/campaignView';
import { renderHexMap } from '../ui/hexMapView';
import type { UIState } from '../ui/shared';
import {
  armyAt, arrivalOutcome, hireHero, hireQuote, marchQuote, moveTroops, newGame, playerMarchOptions, recruit, recruitQuote,
} from './campaign';
import { charterQuote, decideFenwickCharter } from './quests';
import { getCampaign } from '../content';
import { neighbors, stepCost, townLocation } from './world';

const ui = (selected: string): UIState => ({ selected, checked: new Set(), battleUnit: null, battleSpell: null, message: '', view: 'map' });

describe('action quotes: each command refuses with exactly its quote’s reason', () => {
  it('recruiting', () => {
    const s = newGame(1);
    expect(recruitQuote(s, 'aldenhold', 'militia')).toEqual({ gold: 60, men: 20, reason: null });
    expect(recruitQuote(s, 'millbrook', 'knights').reason).toMatch(/can't raise Knights/);
    s.gold = 10;
    const broke = recruitQuote(s, 'aldenhold', 'militia');
    expect(broke.reason).toBe('You need 60 gold.');
    expect(recruit(s, 'aldenhold', 'militia')).toBe(broke.reason);
  });

  it('recruiting from a town with no men to spare is refused by the quote, and the button agrees', () => {
    const s = newGame(1);
    s.towns.millbrook.pop = 510;
    const quote = recruitQuote(s, 'millbrook', 'militia');
    expect(quote.reason).toBe('Millbrook has no more men to spare.');
    expect(recruit(s, 'millbrook', 'militia')).toBe(quote.reason);
    // Before quotes the button only checked gold, so it stayed enabled here.
    const html = renderCampaign(s, ui('millbrook'));
    expect(html).toMatch(/data-action="recruit" data-node="millbrook" data-type="militia" disabled/);
    expect(html).toContain('Millbrook has no more men to spare.');
  });

  it('hiring a hero', () => {
    const s = newGame(1);
    const offer = s.offers[0];
    expect(hireQuote(s, offer)).toEqual({ gold: 300, reason: null });
    s.gold = 0;
    expect(hireHero(s, offer)).toBe(hireQuote(s, offer).reason);
    expect(hireQuote(s, offer).reason).toBe('You need 300 gold.');
  });

  it('marching: cost, path and what the march runs into', () => {
    const s = newGame(1);
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    expect(marchQuote(s, 'aldenhold', ids, 'gharzak').reason).toBe('That place is not next to this one.');
    expect(moveTroops(s, 'aldenhold', ids, 'gharzak')).toBe('That place is not next to this one.');
    expect(marchQuote(s, 'aldenhold', ids, 'fenwick')).toMatchObject({ cost: 1, path: ['fenwick'], ends: 'battle', reason: null });
    expect(marchQuote(s, 'aldenhold', ids, 'bridge')).toMatchObject({ ends: null, reason: null });
  });

  it('the Fenwick charter: envoy range comes from the quote, for the command and the panel alike', () => {
    const s = newGame(1);
    s.armies = s.armies.filter((a) => a.at !== 'aldenhold');
    const far = charterQuote(s);
    expect(far.reason).toMatch(/Send an army to Fenwick/);
    expect(decideFenwickCharter(s, 'sign')).toBe(far.reason);
    const html = renderCampaign(s, ui('fenwick'));
    expect(html).toMatch(/data-action="fenwick-sign" disabled/);
    expect(html).toContain(far.reason!);
  });
});

describe('arrival outcome: one rule for the march quote and the map highlight', () => {
  it('an allied Fenwick is neither a battle nor a capture after the charter is signed', () => {
    const s = newGame(1);
    expect(arrivalOutcome(s, 'fenwick')).toBe('battle');
    expect(decideFenwickCharter(s, 'sign')).toBeNull();
    expect(arrivalOutcome(s, 'fenwick')).toBeNull();
    const ids = armyAt(s, 'aldenhold', 'player')!.troops.map((t) => t.id);
    expect(marchQuote(s, 'aldenhold', ids, 'fenwick').ends).toBeNull();
  });

  it('the hex map marks only real fights and captures in red', () => {
    const s = newGame(1, 'western-realm');
    const world = getCampaign('western-realm').hex!;
    const capital = townLocation(s, 'aldenhold');
    const ids = armyAt(s, capital, 'player')!.troops.map((t) => t.id);
    const targets = playerMarchOptions(s, capital, ids);
    const fenwick = townLocation(s, 'fenwick');
    expect(targets.has(fenwick)).toBe(true);
    const red = () => (renderHexMap(s, ui(capital), world, targets).match(/class="reach ends"/g) ?? []).length;
    const before = red();
    // Bring an envoy next to Fenwick and sign: the same hex stops being marked as a fight.
    s.armies.find((a) => a.at === capital)!.at = neighbors(s, fenwick).find((k) => stepCost(s, k) < Infinity)!;
    expect(decideFenwickCharter(s, 'sign')).toBeNull();
    expect(arrivalOutcome(s, fenwick)).toBeNull();
    expect(red()).toBe(before - 1);
  });
});
