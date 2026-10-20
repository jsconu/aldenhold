import type { EffectId, Spell, SpellId } from '../game/types';

export const MAGE_SPELLS: SpellId[] = ['fireball', 'ward', 'terror', 'frost', 'haste', 'slow', 'lightning', 'dispel', 'entangle', 'teleport', 'quake', 'chain-lightning', 'firestorm', 'disintegrate'];
export const EFFECTS: Record<EffectId, { name: string; turns: number; beneficial: boolean; text: string }> = {
  ward: { name: 'Ward', turns: 2, beneficial: true, text: '+2 physical defense; half spell damage.' },
  frost: { name: 'Frost', turns: 1, beneficial: false, text: 'Movement −1.' },
  haste: { name: 'Haste', turns: 2, beneficial: true, text: 'Movement +2; never restores spent actions.' },
  slow: { name: 'Slow', turns: 2, beneficial: false, text: 'Movement −2; melee attack damage −25%.' },
  entangle: { name: 'Entangle', turns: 1, beneficial: false, text: 'Movement capped at 1; can still attack or cast.' },
};
const spell = (s: Omit<Spell, 'radius' | 'lineOfSight'> & Partial<Pick<Spell, 'radius' | 'lineOfSight'>>): Spell => ({ radius: 0, lineOfSight: false, ...s });
export const SPELLS: Record<SpellId, Spell> = {
  fireball: spell({ id: 'fireball', name: 'Fireball', level: 1, cost: 4, range: 5, target: 'enemy', damageKind: 'fire', text: '4 + 2×level fire damage, reduced by armor/resistance; −10 morale.' }),
  ward: spell({ id: 'ward', name: 'Ward', level: 1, cost: 3, range: 4, target: 'friend', text: '+2 defense and half spell damage for 2 allied turns. Dispellable; refreshes without stacking.' }),
  terror: spell({ id: 'terror', name: 'Terror', level: 2, cost: 3, range: 5, target: 'enemy', text: 'Lose 30 + 5×level morale. Heroes are fearless and immune.' }),
  frost: spell({ id: 'frost', name: 'Frost', level: 2, cost: 4, range: 4, target: 'enemy', damageKind: 'cold', text: '3 + level cold damage; movement −1 for 1 enemy turn.' }),
  haste: spell({ id: 'haste', name: 'Haste', level: 3, cost: 4, range: 4, target: 'friend', text: 'Movement +2 for 2 allied turns. Removes Slow; no extra actions.' }),
  slow: spell({ id: 'slow', name: 'Slow', level: 3, cost: 4, range: 4, target: 'enemy', text: 'Movement −2 and melee damage −25% for 2 enemy turns. Removes Haste.' }),
  lightning: spell({ id: 'lightning', name: 'Lightning', level: 4, cost: 6, range: 6, target: 'enemy', damageKind: 'lightning', lineOfSight: true, text: '6 + 2×level lightning damage. Rocks block the straight line of sight; armor does not.' }),
  dispel: spell({ id: 'dispel', name: 'Dispel', level: 4, cost: 4, range: 5, target: 'either', text: 'Remove harmful effects from an ally or beneficial effects from an enemy. Preview lists removals.' }),
  entangle: spell({ id: 'entangle', name: 'Entangle', level: 5, cost: 6, range: 5, target: 'enemy', radius: 1, text: 'Enemy formations within 1 hex of the target move at most 1 for their next turn. Allies are unaffected.' }),
  teleport: spell({ id: 'teleport', name: 'Teleport', level: 5, cost: 6, range: 5, target: 'friend', text: 'Choose an ally, then an empty passable hex within 5 of both ally and caster. Uses the ally’s move, preserves its attack state.' }),
  quake: spell({ id: 'quake', name: 'Quake', level: 6, cost: 8, range: 4, target: 'enemy', radius: 1, damageKind: 'earth', text: '3 + level earth damage to ALL formations within 1 hex. Breaks the battlefield wall bonus when a defender is hit.' }),
  'chain-lightning': spell({ id: 'chain-lightning', name: 'Chain Lightning', level: 7, cost: 9, range: 5, target: 'enemy', damageKind: 'lightning', lineOfSight: true, text: '5 + level lightning damage; jumps to up to 2 more enemies within 2 hexes of the last target, losing 25% power per jump. Rocks block each jump.' }),
  firestorm: spell({ id: 'firestorm', name: 'Firestorm', level: 8, cost: 10, range: 5, target: 'enemy', radius: 1, damageKind: 'fire', text: '5 + level fire damage to ALL formations within 1 hex. Friendly fire: preview before committing.' }),
  disintegrate: spell({ id: 'disintegrate', name: 'Disintegrate', level: 9, cost: 12, range: 4, target: 'enemy', damageKind: 'arcane', text: '12 + 2×level arcane damage. Capped at 40% of maximum HP against heroes; cannot instantly erase a healthy hero.' }),
  heal: spell({ id: 'heal', name: 'Heal', level: 1, cost: 3, range: 3, target: 'friend', text: 'Restore 4 + 2×level men or HP, up to the battle healing cap. Cannot revive the dead.' }),
  rally: spell({ id: 'rally', name: 'Rally', level: 1, cost: 2, range: 4, target: 'friend', text: 'Restore 40 morale and rally a routing formation above the rally threshold. Heroes do not need Rally.' }),
};
