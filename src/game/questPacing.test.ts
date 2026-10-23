import { describe, expect, it } from 'vitest';
import { armyAt, newGame, startLocation } from './campaign';
import { advanceQuests, campaignQuests, enableQuestPacing, isOpen, monthsLeft, sideQuestHighlights } from './quests';
import { parseSave } from './saves';
import { townLocation } from './world';
import { renderCampaign } from '../ui/campaignView';

describe('two relevant side-quest highlights', () => {
  it('keeps every quest and its progress available while highlighting just two', () => {
    const s=newGame(1,'western-realm');s.turn=4;advanceQuests(s);
    const before=JSON.stringify(s.quests);enableQuestPacing(s);
    expect(JSON.stringify(s.quests)).toBe(before);
    const open=campaignQuests(s).filter(q=>q.kind==='side' && isOpen(s.quests[q.id]));
    expect(open.length).toBeGreaterThan(2);
    expect(sideQuestHighlights(s)).toHaveLength(2);
    const html=renderCampaign(s,{selected:townLocation(s,'aldenhold'),checked:new Set(),battleUnit:null,battleSpell:null,message:'',view:'quests'});
    expect(html).toContain('Recommended side quests');
    expect(html).toContain('Other available side quests');
    for(const q of open) expect(html).toContain(q.name);
    expect(parseSave(JSON.stringify(s)).questPacing).toEqual({highlights:2});
  });

  it('recommends an encounter when the player brings leaders to that location, replacing resolved highlights', () => {
    const s=newGame(1,'western-realm');enableQuestPacing(s);s.turn=4;advanceQuests(s);
    const army=armyAt(s,townLocation(s,'aldenhold'),'player')!;army.at=startLocation(s,'quarry');
    expect(sideQuestHighlights(s,army.at).map(q=>q.id)).toContain('Q02');
    army.at=startLocation(s,'watchtower');advanceQuests(s);
    expect(sideQuestHighlights(s,army.at).map(q=>q.id)).toContain('Q03');
    s.quests.Q03.status='succeeded';
    expect(sideQuestHighlights(s,army.at).map(q=>q.id)).not.toContain('Q03');
  });

  it('gives failure deadlines more time while leaving main objectives and existing dates untouched', () => {
    const s=newGame(1,'western-realm');enableQuestPacing(s);s.turn=3;advanceQuests(s);
    expect(monthsLeft(s,'Q04')).toBe(8);
    const started=s.quests.Q04.stageTurn;
    s.turn=9;advanceQuests(s);
    expect(s.quests.Q04.status).toBe('available');
    expect(monthsLeft(s,'Q04')).toBe(2);
    expect(s.quests.Q04.stageTurn).toBe(started);
    expect(sideQuestHighlights(s).map(q=>q.id)).toContain('Q04');
    expect(s.quests.M01.status).toBe('available');
  });
});
