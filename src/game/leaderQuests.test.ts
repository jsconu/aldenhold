import { describe, expect, it } from 'vitest';
import { applyBattle, armyAt, makeTroop, newGame, startLocation } from './campaign';
import { advanceQuests, chooseQuest, questQuote } from './quests';
import { retreat } from './battle';
import { parseSave } from './saves';
import { isHero } from './units';

describe.each([
  ['Q02', 'hunt', 'quarry'], ['Q03', 'enter', 'watchtower'],
])('%s leader-only encounters', (quest, choice, site) => {
  function setup() {
    const state = newGame(1, 'western-realm');
    state.turn = 4;
    const army = armyAt(state, startLocation(state, 'aldenhold'), 'player')!;
    army.at = startLocation(state, site);
    advanceQuests(state);
    return { state, army };
  }

  it('refuses an ordinary army without spending resources or starting a battle', () => {
    const { state, army } = setup();
    // Leave the ruler safely at home rather than removing them from the campaign.
    const ruler = army.troops.shift()!;
    state.armies.push({ id: state.nextId++, owner: 'player', at: startLocation(state, 'aldenhold'), from: null, troops: [ruler] });
    const before = JSON.stringify(state);
    expect(chooseQuest(state, quest, choice)).toContain('Leaders only');
    expect(JSON.stringify(state)).toBe(before);
    const hero = makeTroop(state, 'champion', 'Brannoc');
    army.troops.push(hero);
    expect(questQuote(state, quest, choice).encounter!.deployed).toEqual([hero.id]);
  });

  it.each(['lord', 'rulerPriest', 'rulerMage'])('allows a %s ruler and rejoins untouched soldiers after saved retreat', (type) => {
    const { state, army } = setup();
    army.troops[0] = makeTroop(state, type, 'Ruler');
    army.troops.push(makeTroop(state, 'priest', 'Healer'));
    const soldiers = structuredClone(army.troops.filter((t) => !isHero(t.type)));
    const quote = questQuote(state, quest, choice);
    expect(quote.reason).toBeNull();
    expect(chooseQuest(state, quest, choice)).toBeNull();
    expect(state.battle!.units.filter((u) => u.side === 'attacker').every((u) => isHero(u.type))).toBe(true);
    const loaded = parseSave(JSON.stringify(state));
    retreat(loaded.battle!, 'attacker');
    applyBattle(loaded, loaded.battle!);
    const reunited = armyAt(loaded, army.at, 'player')!;
    expect(reunited.troops.filter((t) => !isHero(t.type))).toEqual(soldiers);
    expect(reunited.troops.filter((t) => isHero(t.type))).toHaveLength(2);
    expect(loaded.armies.filter((a) => a.owner === 'player' && a.at === army.at)).toHaveLength(1);
    expect(loaded.quests[quest].status).toBe('active');
    expect(loaded.status).toBe('playing');
  });
});
