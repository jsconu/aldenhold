/**
 * Pixel-art unit sprites in an EGA-inspired palette, drawn for this game (not copied from any original).
 * Each sprite is 16×16: one character per pixel, '.' is transparent. 'T' and 't' are the team colours,
 * so one drawing serves both sides. Sprites face right; the renderer mirrors them for the defending side.
 */

export const SPRITE_SIZE = 16;

/** Fixed colours. Mostly the 16-colour EGA set, plus a skin tone and two darks. */
export const PALETTE: Record<string, string> = {
  k: '#000000', // outline, eyes
  w: '#ffffff', // white: cloth, bone, horse, steel highlight
  g: '#aaaaaa', // steel
  G: '#555555', // dark steel
  b: '#aa5500', // wood, leather
  y: '#ffff55', // gold
  s: '#f0a878', // human skin
  o: '#55aa00', // orc and troll skin
  O: '#2c5500', // dark orc green
  m: '#aa00aa', // mage robe
  M: '#ff55ff', // mage robe light
  c: '#55ffff', // magic orb
  r: '#aa0000', // plume
  f: '#00aa00', // woodland green: hoods and cloaks
};

export const TEAM_COLOURS: Record<'mine' | 'foe', { T: string; t: string }> = {
  mine: { T: '#5555ff', t: '#0000aa' },
  foe: { T: '#ff5555', t: '#aa0000' },
};

export const SPRITES: Record<string, string[]> = {
  militia: [
    '................',
    '...........g.g.g',
    '...........g.g.g',
    '....yyyy...ggggg',
    '...yyyyyy....b..',
    '....kssk.....b..',
    '....ssss.....b..',
    '...tTTTTt....b..',
    '..tTTTTTTt...b..',
    '..sTTTTTTtsssb..',
    '...TTTTTT....b..',
    '...bbbbbb....b..',
    '...bb..bb....b..',
    '...bb..bb....b..',
    '...GG..GG....b..',
    '..GGG..GGG......',
  ],
  spearmen: [
    '.............w..',
    '............wgw.',
    '.............g..',
    '.....GGG.....b..',
    '....GgggG....b..',
    '....GsssG....b..',
    '.....sss.....b..',
    '.ttt.ggg.....b..',
    'tTTTtgTTgg...b..',
    'tTyTtTTTTgsssb..',
    'tTTTtTTTT....b..',
    '.ttt.gggg....b..',
    '.....bb.bb...b..',
    '.....bb.bb...b..',
    '.....GG.GG...b..',
    '....GGG.GGG..b..',
  ],
  archers: [
    '................',
    '..........bb....',
    '.....ttt....b...',
    '....tTTTt....b..',
    '....tssst....b..',
    '....tsss.....b..',
    '.....ss......b..',
    '....TTTT..wwwbw.',
    '...TTTTTTsss.b..',
    '...TTTTTT....b..',
    '...TbbbbT...b...',
    '....GGGG...b....',
    '....GG.GG.bb....',
    '....GG.GG.......',
    '....bb.bb.......',
    '...bbb.bbb......',
  ],
  woodlandArchers: [
    '..........b.....',
    '.....fff...b....',
    '....fffff...b...',
    '....fsssf....b..',
    '....fsss.....b..',
    '.....ss......b..',
    '....fTTf..wwwbw.',
    '...ffTTffsss.b..',
    '...fTTTTf....b..',
    '...fTbbTf....b..',
    '...ffTTff...b...',
    '....bbbb...b....',
    '....bb.bb.b.....',
    '....bb.bb.......',
    '....bb.bb.......',
    '...bbb.bbb......',
  ],
  scout: [
    '................',
    '.....fff........',
    '....fffff.......',
    '....fsssf.......',
    '....fsss.....gg.',
    '.....ss.....gggg',
    '....fTTf..ggggg.',
    '...ffTTffsss....',
    '...fTTTTf.......',
    '...fTbbTf.......',
    '...ffTTff.......',
    '....bbbb........',
    '....bb.bb.......',
    '....bb.bb.......',
    '....bb.bb.......',
    '...bbb.bbb......',
  ],
  // Engineers: leather cap, a mallet over the shoulder and a plank under the arm.
  engineer: [
    '................',
    '.....bbbb...GGG.',
    '....bbbbbb..GGG.',
    '....kssk.....b..',
    '....ssss....b...',
    '.....ss....b....',
    '....bTTb..b.....',
    '...bbTTbbb......',
    '...bTTTTb.......',
    '..wwwwwwwwww....',
    '...bTTTTb.......',
    '....bbbb........',
    '....bb.bb.......',
    '....bb.bb.......',
    '....bb.bb.......',
    '...bbb.bbb......',
  ],
  // Spy: a dark hood and cloak, face in shadow, a small blade.
  spy: [
    '................',
    '.....GGG........',
    '....GGGGG.......',
    '....GkskG.......',
    '....GsssG.......',
    '....GGsGG.......',
    '...GGTTGG.......',
    '..GGGTTGGG......',
    '..GGTTTTGG..g...',
    '..GGTTTTGGsg....',
    '..GGGTTGGG......',
    '...GGGGGG.......',
    '....kk.kk.......',
    '....kk.kk.......',
    '....kk.kk.......',
    '...kkk.kkk......',
  ],
  knights: [
    '......GG........',
    '.....GggG.......',
    '.....GkgG.......',
    '......gg........',
    '....tTTTt.......',
    '...tTTTTTggggggw',
    '...tTTTTt...www.',
    '....TTTT...wwkw.',
    '.wwwwbbwwwwwwww.',
    'wwwwwwwwwwww....',
    'wwTTTTTTTwww....',
    '.wTTTTTTTww.....',
    '.ww.ww..ww.ww...',
    '.gg.gg..gg.gg...',
    '.g..g...g..g....',
    '.G..G...G..G....',
  ],
  warband: [
    '................',
    '...........GG...',
    '..........GggG..',
    '.....oOo...Gg...',
    '....oooooo.b....',
    '....okokoo.b....',
    '....owowo..b....',
    '...tTTTTt..b....',
    '..oTTTTTTo.b....',
    '..ooTbbTToob....',
    '...TTTTTT..b....',
    '...GbbbbG..b....',
    '...OO..OO.......',
    '...OO..OO.......',
    '...oo..oo.......',
    '..ooo..ooo......',
  ],
  orcArchers: [
    '................',
    '..........bb....',
    '.....oOo....b...',
    '....oooo.....b..',
    '....okok.....b..',
    '....owow.....b..',
    '.....oo......b..',
    '....tTTt..wwwbw.',
    '...tTTTTtooo.b..',
    '...TTTTTT....b..',
    '...TbbbbT...b...',
    '....GGGG...b....',
    '....OO.OO.bb....',
    '....OO.OO.......',
    '....oo.oo.......',
    '...ooo.ooo......',
  ],
  troll: [
    '.....ooooo...bbb',
    '....oOoOoOo..bgb',
    '....okooook..bbb',
    '....owwwwwo...b.',
    '...ooooooooo..b.',
    '..ooooooooooo.b.',
    '.ooooooooooooob.',
    '.oo.ooooooo.oob.',
    '.oo.ooooooo.oob.',
    '.kk.TTTTTTT.kkb.',
    '....TtTtTtT.....',
    '....ooo.ooo.....',
    '....ooo.ooo.....',
    '....ooo.ooo.....',
    '...oooo.oooo....',
    '..kkkkk.kkkkk...',
  ],
  cyclops: [
    '....ssssss..ggg.',
    '...ssssssss.gGGg',
    '...sswwkwss.gGGg',
    '...ssssssss..gg.',
    '....skkkks...s..',
    '..ssssssssssss..',
    '.ssssssssssssss.',
    '.ss.ssssssss.ss.',
    '.ss.TTTTTTTT.ss.',
    '.kk.TtTtTtTt.kk.',
    '....TTTTTTTT....',
    '....sss..sss....',
    '....sss..sss....',
    '....sss..sss....',
    '...ssss..ssss...',
    '..bbbbb..bbbbb..',
  ],
  minotaur: [
    '..w..........w..',
    '..ww.bbbbbb.ww..',
    '...wwbbbbbbww...',
    '.....bkbbkb.....',
    '.....bbbbbb...g.',
    '......byyb....g.',
    '...bbbbbbbbbb.g.',
    '..bbbbbbbbbbbbg.',
    '..bb.bbbbbb.bbg.',
    '..bb.TTTTTT.gGGg',
    '..kk.TtTtTt..GG.',
    '.....TTTTTT.....',
    '.....bbb.bbb....',
    '.....bbb.bbb....',
    '.....bb...bb....',
    '....kkk...kkk...',
  ],
  goblinSkirmishers: [
    '................',
    '................',
    '.........g......',
    '.....ooo.g......',
    '....okoko.g.....',
    '....ooooo.g.....',
    '.....ooo..g.....',
    '....TTTTTog.....',
    '...oTTTTT.g.....',
    '...o.TtT..g.....',
    '.....TTT..g.....',
    '.....o.o..g.....',
    '.....o.o........',
    '....kk.kk.......',
    '................',
    '................',
  ],
  goblinArchers: [
    '................',
    '................',
    '..........b.....',
    '.....ooo...b....',
    '....okoko...b...',
    '....ooooo...b...',
    '.....ooo....b...',
    '....TTTTT.wwbw..',
    '...oTTTTT...b...',
    '...o.TtT...b....',
    '.....TTT..b.....',
    '.....o.o........',
    '.....o.o........',
    '....kk.kk.......',
    '................',
    '................',
  ],
  giant: [
    '....bbbbbb......',
    '...bssssssb.....',
    '...sskssks......',
    '...ssssssss.....',
    '....swwwws......',
    '..ssssssssss..g.',
    '.ssssssssssss.gG',
    '.ss.TTTTTTTT.sgG',
    '.ss.TtTtTtTt.ss.',
    '.ss.TTTTTTTT.ss.',
    '.kk.bbbbbbbb.kk.',
    '....sss..sss....',
    '....sss..sss....',
    '....sss..sss....',
    '...ssss..ssss...',
    '..bbbbb..bbbbb..',
  ],
  titan: [
    '...yyyyyyyy.....',
    '...cccccccc.....',
    '..ccwkccwkc.....',
    '..cccccccccc....',
    '...cwwwwwcc.....',
    '.ccccccccccccc..',
    'cccccccccccccccy',
    'cc.TTTTTTTTT.ccy',
    'cc.TtTtTtTtT.ccy',
    'cc.TTTTTTTTT.cc.',
    'yy.ccccccccc.yy.',
    '...ccc...ccc....',
    '...ccc...ccc....',
    '...ccc...ccc....',
    '..cccc...cccc...',
    '.yyyyy...yyyyy..',
  ],
  lord: [
    '......y.y.y..w..',
    '......yyyyy..w..',
    '......sssss..w..',
    '......sksks..w..',
    '.......sss...w..',
    '....ttTyTTt.yyy.',
    '...ttTTyTTTsss..',
    '..tttTTyTTT.....',
    '..ttgTTyTTg.....',
    '..ttgTTyTTg.....',
    '.tttTTTyTTT.....',
    '.ttt.ggggg......',
    '.tt..gg.gg......',
    '.t...gg.gg......',
    '.....GG.GG......',
    '....GGG.GGG.....',
  ],
  champion: [
    '.....rr.....w...',
    '....rGGG....w...',
    '....GgggG...w...',
    '....GkgkG...w...',
    '....GgggG...w...',
    '...ggTTTgg..w...',
    '..ggTTTTTgg.w...',
    '..sgTTTTTgsyyy..',
    '...gTTTTTg..b...',
    '....TTTTT.......',
    '....TTTTT.......',
    '....ggggg.......',
    '....gg.gg.......',
    '....gg.gg.......',
    '....GG.GG.......',
    '...GGG.GGG......',
  ],
  priest: [
    '............y...',
    '...........yyy..',
    '............y...',
    '.....www....b...',
    '....wsssw...b...',
    '....wsksw...b...',
    '.....sss....b...',
    '....wwTww...b...',
    '...wwwTwwwssb...',
    '...wwwTwww..b...',
    '...wwwTwww..b...',
    '...wwwTwww..b...',
    '..wwwwTwwww.b...',
    '..wwwwwwwww.b...',
    '..ggggggggg.b...',
    '...kk...kk..b...',
  ],
  mage: [
    '.......m........',
    '......mMm....cc.',
    '......mmm...cccc',
    '.....mmMmm...cc.',
    '....TTTTTTT..b..',
    '.....sksks...b..',
    '.....wwwww...b..',
    '.....mwwwm...b..',
    '....mmmwmmmssb..',
    '....mmmmmmm..b..',
    '...mmmTmmmm..b..',
    '...mmmTmmmm..b..',
    '...mmmTmmmmm.b..',
    '..mmmmmmmmmm.b..',
    '..MMMMMMMMMM.b..',
    '...kk....kk..b..',
  ],
  warchief: [
    '..w......w......',
    '..w......w..GgG.',
    '..wwGGGGww.GgggG',
    '....GgggG...GbG.',
    '....ooooo....b..',
    '....okook....b..',
    '....owwwo....b..',
    '...tTTTTTt...b..',
    '..oTTyTTTTooob..',
    '..oTTTTTTT...b..',
    '..oGbbbbbG...b..',
    '...TTTTTTT...b..',
    '...OOO.OOO......',
    '...OO...OO......',
    '...oo...oo......',
    '..ooo...ooo.....',
  ],
  shaman: [
    '...........www..',
    '...........kwk..',
    '...........www..',
    '.....bbb....b...',
    '....booob...b...',
    '....bokob...b...',
    '....bowob...b...',
    '....bbTbb...b...',
    '...bbbTbbboob...',
    '...bbbTbbb..b...',
    '...bbbTbbb..b...',
    '...bbbbbbb..b...',
    '..bbbbbbbbb.b...',
    '..bbbbbbbbb.b...',
    '..GGGGGGGGG.b...',
    '...oo...oo..b...',
  ],
};

function spriteRects(rows: string[], team: { T: string; t: string }): string {
  return pixelRects(rows, (ch) => (ch === 'T' ? team.T : ch === 't' ? team.t : PALETTE[ch]));
}

/** Merge runs of same-coloured pixels in a row into one rect, so a sprite is a few dozen rects, not one per pixel. */
export function pixelRects(rows: string[], colourOf: (ch: string) => string | undefined): string {
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = ch === '.' ? undefined : colourOf(ch);
      if (fill) out += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`;
      x = end;
    }
  });
  return out;
}

SPRITES.rulerPriest=SPRITES.priest;
SPRITES.rulerMage=SPRITES.mage;

/** One <symbol> per unit type and team, for <use> in the battle SVG. */
export function pixelSpriteDefs(): string {
  let defs = '';
  for (const [type, rows] of Object.entries(SPRITES)) {
    for (const [side, team] of Object.entries(TEAM_COLOURS)) {
      defs += `<symbol id="px-${type}-${side}" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}"><g shape-rendering="crispEdges">${spriteRects(rows, team)}</g></symbol>`;
    }
  }
  return defs;
}

/** A sprite standing with its feet near (cx, feetY), `scale` screen pixels per sprite pixel. */
export function pixelSprite(type: string, side: 'mine' | 'foe', cx: number, feetY: number, scale: number, faceLeft: boolean): string {
  if (!SPRITES[type]) return '';
  const size = SPRITE_SIZE * scale;
  const x = cx - size / 2;
  const y = feetY - size;
  const use = `<use href="#px-${type}-${side}" x="${x}" y="${y}" width="${size}" height="${size}" class="px"/>`;
  return faceLeft ? `<g transform="translate(${2 * cx} 0) scale(-1 1)">${use}</g>` : use;
}
