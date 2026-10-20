import { describe, expect, it } from 'vitest';
import { CATALOG, getCampaign, type Catalog } from './index';
import { validateContent } from './validate';

/** A deep copy of the catalog with one campaign edited, so tests can break content safely. */
function withQuickplay(edit: (c: Catalog['campaigns']['valley-quickplay']) => void): Catalog {
  const copy = structuredClone(CATALOG);
  edit(copy.campaigns['valley-quickplay']);
  return copy;
}

describe('content catalog', () => {
  it('ships with no content errors', () => {
    expect(validateContent(CATALOG)).toEqual([]);
  });

  it('keeps the quick-play valley as the nine-location fixture', () => {
    const c = getCampaign('valley-quickplay');
    expect(c.nodes).toHaveLength(9);
    expect(c.edges).toHaveLength(14);
    expect(c.towns).toHaveLength(6);
  });

  it('rejects unknown campaigns', () => {
    expect(() => getCampaign('nowhere' as 'valley-quickplay')).toThrow(/Unknown campaign/);
  });
});

describe('content validator', () => {
  const problems = (edit: Parameters<typeof withQuickplay>[0]) => validateContent(withQuickplay(edit)).join('\n');

  it('catches duplicate locations and roads to nowhere', () => {
    expect(problems((c) => c.nodes.push({ ...c.nodes[0] }))).toMatch(/duplicate location "aldenhold"/);
    expect(problems((c) => c.edges.push(['aldenhold', 'atlantis']))).toMatch(/unknown location "atlantis"/);
  });

  it('catches locations off the map and unreachable ones', () => {
    expect(problems((c) => (c.nodes[1].x = 9000))).toMatch(/"fenwick" is off the map/);
    expect(problems((c) => (c.edges = c.edges.filter(([a, b]) => a !== 'gharzak' && b !== 'gharzak')))).toMatch(/"gharzak" cannot be reached/);
  });

  it('catches unknown units, unnamed heroes and a missing lord', () => {
    expect(problems((c) => c.armies[0].troops.push('dragon'))).toMatch(/unknown unit "dragon"/);
    expect(problems((c) => c.armies[0].troops.push('mage'))).toMatch(/hero "mage" .* needs a name/);
    expect(problems((c) => (c.armies[0].troops = c.armies[0].troops.slice(1)))).toMatch(/exactly one lord \(found 0\)/);
  });

  it('catches a broken capital, lair or hero offer', () => {
    expect(problems((c) => (c.capital = 'fenwick'))).toMatch(/capital "fenwick"/);
    expect(problems((c) => (c.lair = 'millbrook'))).toMatch(/lair "millbrook"/);
    expect(problems((c) => (c.offers[0].type = 'lord'))).toMatch(/non-hireable type "lord"/);
  });

  it('catches rules content that refers to missing spells or heroes', () => {
    const copy = structuredClone(CATALOG);
    copy.units.mage.hero!.spells.push('meteor' as 'fireball');
    copy.hireableHeroes.push('militia');
    const out = validateContent(copy).join('\n');
    expect(out).toMatch(/unknown spell "meteor"/);
    expect(out).toMatch(/"militia" is not a hero unit/);
  });
});


describe('quest and item content references', () => {
  it('resolves the charter quest and its unique evidence object', () => {
    expect(validateContent(CATALOG)).toEqual([]);
    expect(CATALOG.quests.Q00.rewardItem).toBe('fenwick-charter');
    expect(CATALOG.items['fenwick-charter'].questIds).toContain('Q00');
  });
  it('rejects item references to missing quests', () => {
    const broken = structuredClone(CATALOG);
    broken.items['fenwick-charter'].questIds = ['Q99'];
    expect(validateContent(broken).some((e) => e.includes('unknown quest'))).toBe(true);
  });
});
