import { describe, expect, it } from 'vitest';
import { armyAt, makeTroop, newGame } from './campaign';
import { cityWarbandTurn } from './cityWarbands';
import { scoutSees, observeOrcRoutes } from './scouts';
import { renderCampaign } from '../ui/campaignView';
import { lairLocation } from './lairs';
import { LAIRS } from '../content/lairs';
import { resolveRaids } from './raids';
import { parseSave } from './saves';
import { townLocation } from './world';
import type { UIState } from '../ui/shared';

describe('advance news belongs to stationed scouts', () => {
  function fixture() {
    const s = newGame(7, 'western-realm');
    s.turn = 6;
    s.challenge = { difficulty: 'normal', fog: false, explored: [] };
    const origin = townLocation(s, 'fenwick'), home = townLocation(s, 'aldenhold');
    const garrison = armyAt(s, origin, 'neutral')!;
    while (garrison.troops.length < 6) garrison.troops.push(makeTroop(s, 'spearmen'));
    s.cityPolitics = {lastTurn:5,rivals:{fenwick:{nextRaidTurn:6}}};
    const scout = makeTroop(s, 'scout');
    const post = {id:s.nextId++,owner:'player' as const,at:home,from:null,troops:[scout]};
    s.armies.push(post);
    const ui: UIState = {selected:home,checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'map'};
    return {s,origin,home,scout,post,ui};
  }

  it('hides rival musters without a scout, with an unstationed scout, or with a distant post', () => {
    const {s,origin,scout,post,ui} = fixture();
    cityWarbandTurn(s);
    expect(s.cityPolitics!.rivals.fenwick.warning).toBeDefined();
    expect(s.journal.some((j) => j.text.includes('mustering'))).toBe(false);
    expect(renderCampaign(s,ui).includes('class="city-war-warning"')).toBe(false);
    post.at = origin;
    expect(scoutSees(s,origin)).toBe(false);
    scout.scoutPost = 'watch';
    post.at = '0,0';
    expect(renderCampaign(s,ui).includes('class="city-war-warning"')).toBe(false);
    post.at = origin;
    expect(renderCampaign(s,ui)).toContain('Fenwick is mustering against');
    delete scout.scoutPost;
    expect(renderCampaign(s,ui).includes('class="city-war-warning"')).toBe(false);
  });

  it('creates a source report only when an assigned scout sees the muster', () => {
    const {s,origin,scout,post} = fixture();
    post.at = origin; scout.scoutPost = 'watch';
    cityWarbandTurn(s);
    expect(s.journal.some((j) => j.text.startsWith('Fenwick is mustering'))).toBe(true);
    expect(scoutSees(parseSave(JSON.stringify(s)),origin)).toBe(true);
  });

  it('does not reveal an approaching army merely because its target has a distant scout', () => {
    const {s,home,origin,scout,post,ui} = fixture();
    const enemy = {id:s.nextId++,owner:'neutral' as const,at:origin,from:null,troops:[makeTroop(s,'spearmen')],cityRaid:{origin:'fenwick',target:'aldenhold',launched:s.turn}};
    s.armies.push(enemy); scout.scoutPost='watch';
    observeOrcRoutes(s,enemy,[home]);
    expect(s.scoutContacts ?? []).toHaveLength(0);
    expect(renderCampaign(s,ui)).not.toContain('war party marching on Aldenhold');
    post.at=origin;
    observeOrcRoutes(s,enemy,[home]);
    expect(s.scoutContacts).toHaveLength(1);
    expect(s.journal.at(-1)!.text).toContain('Scout at Fenwick reports');
    expect(renderCampaign(s,ui)).toContain('war party marching on Aldenhold');
  });

  it('keeps remote monster-raid reminders quiet until a stationed scout sees the source or final approach', () => {
    const {s,scout,post} = fixture();
    s.raids.push({lair:'eldersanctum',target:'westmere',announced:s.turn-2,arrives:s.turn+1});
    s.towns.westmere.owner='player';
    expect(resolveRaids(s)).toEqual([]);
    scout.scoutPost='watch'; post.at=lairLocation(s,LAIRS.eldersanctum);
    expect(resolveRaids(s)).toEqual(['Raiders reach Westmere next month.']);
    delete scout.scoutPost;
    expect(resolveRaids(s)).toEqual([]);
  });
});
