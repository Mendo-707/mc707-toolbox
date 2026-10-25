// What Fill tones' pools are made of beyond the hand-picked suggestions: for each clip job, the ZenCore
// categories that suit it, and for each genre (and style) words in a tone's name that suit it or do not.
// Matched against the sounds you have (the factory tones you added from the MC-707 update file, your own
// sounds), so a pool fills with dozens of fitting tones without the app keeping Roland's list.
//
// Reads: nothing (rules only; fill-tones.js applies them).

/** The ZenCore categories that suit each clip job, best first. */
export const ROLE_CATS = {
  bass: ['Synth Bass', 'E.Bass', 'Ac.Bass'],
  acid: ['Synth Bass'],
  chords: [
    'E.Piano1',
    'E.Piano2',
    'Synth PolyKey',
    'Ac.Piano',
    'Pop-Piano',
    'E.Grand Piano',
    'E.Organ',
    'Synth Brass',
    'Hit',
    'Ensemble Brass',
    'Clav',
    'E.Guitar',
    'Ac.Guitar'
  ],
  pad: ['Synth Pad/Str', 'Synth BellPad', 'Ensemble Strs', 'Vox/Choir', 'Orchestral', 'Pipe Organ'],
  lead: ['Synth Lead', 'Solo Brass', 'Flute', 'Sax', 'Wind', 'Scat', 'Solo Strings', 'Recorder', 'Dist.Guitar'],
  pluck: ['Synth Seq/Pop', 'Pulsating', 'Plucked/Stroke', 'Mallet', 'Bell', 'Celesta', 'Phrase', 'Beat&Groove'],
  fx: ['Synth FX', 'Sound FX', 'Hit']
};
/** Words that mark a tone for a job whatever its category (a bass named "Sub" in Synth Lead, say). */
export const ROLE_WORDS = {
  bass: /bass|\bbs\b|sub\b|808|reese|wobble|wub/i,
  acid: /\btb\b|tb[- ]|acid|303|202|squelch/i,
  chords: /chord|stab|\bep\b|piano|organ|keys|wurly|rhodes|poly|min7|maj7|hit\b/i,
  pad: /pad|strings?\b|\bstr\b|choir|atmos|sweep|scape|warm/i,
  lead: /lead|\bld\b|solo|whistle|sync\b/i,
  pluck: /pluck|seq\b|arp|stac|pizz|mallet|bell|kalimba|marimba|plk/i,
  fx: /\bfx\b|noise|riser|sweep|zap|hit\b|impact|laser|siren/i
};
/** Words that suit (good) and do not suit (bad) a genre or style, in a tone's name. */
export const GENRE_WORDS = {
  dnb: {
    good: /reese|sub|sine|neuro|growl|dark|jungle|soft|tine|\bep\b|atmos|heaven|liquid|dist|moog|mg\b/i,
    bad: /accord|harmonica|banjo|country/i
  },
  hiphop: {
    good: /\bep\b|wurly|rhodes|vibe|kalimba|soft|dusty|lo-?fi|tape|warm|mellow|808|boom|vinyl|string|flute|bell/i,
    bad: /hoover|super ?saw|trance/i
  },
  house: {
    good: /house|garage|organ|piano|m1|stab|deep|round|101|juno|chord|disco|string|korg|bell|vox/i,
    bad: /dist|growl|metal|horror/i
  },
  techno: {
    good: /tekno|techno|\btb\b|202|acid|seq|909|noise|metal|square|sqr|pulse|minimal|dark|stab|perc/i,
    bad: /piano|ep\b|guitar|choir|flute/i
  },
  garage: { good: /garage|organ|2 ?step|chord|stab|vox|piano|\bep\b|round|sub/i, bad: /growl|hoover|metal/i },
  bigbeat: { good: /dist|stab|rave|brass|hoover|break|gtr|guitar|organ|wah|funk|hit/i, bad: /soft|ambient|choir/i },
  dubstep: {
    good: /wob|wub|growl|x-?mod|sc1|monster|dist|horror|metal|yoi|saw|dark|sub/i,
    bad: /piano|guitar|accord|soft/i
  },
  trance: {
    good: /trance|super ?saw|\bjp|hoover|pluck|sweep|uplift|saw|euph|gate|choir|heaven/i,
    bad: /dist|growl|guitar|organ/i
  },
  electro: {
    good: /pwm|compu|vocod|anavox|electro|juno|stab|808|sqr|square|sync|robot|zap/i,
    bad: /piano|choir|string/i
  },
  funk: { good: /slap|clav|wah|funk|brass|\bep\b|wurly|organ|horn|synth brass|moog|mg\b/i, bad: /pad|choir|growl/i },
  reggae: { good: /organ|dub|echo|steel|skank|tri|sine|melodica|guitar|piano/i, bad: /dist|growl|hoover/i },
  latin: { good: /marimba|kalimba|steel|flute|nylon|harp|piano|brass|trumpet|guitar/i, bad: /dist|growl|metal/i },
  synth: {
    good: /juno|\bjp|106|80s|\bob\b|prophet|brass|poly|analog|ana|pwm|dx|fm\b|gated/i,
    bad: /growl|dist|guitar/i
  },
  pop: { good: /pop|piano|grand|bright|vox|pluck|sine|sweet|clean|bell|string/i, bad: /growl|dist|metal|horror/i },
  ambient: {
    good: /pad|scape|glass|particle|amb|soft|boreal|heaven|evol|atmos|drone|bell|choir|air|dream/i,
    bad: /dist|growl|metal|slap|wob/i
  },
  rock: { good: /dist|gtr|guitar|organ|power|chunk|grunge|crunch|overdrive|rotary/i, bad: /trance|pad|choir/i },
  /* styles: their own words on top of their family's */
  neuro: { good: /neuro|growl|monster|metal|reese|dist|x-?mod/i },
  jungle: { good: /jungle|amen|reese|sub|ragga|dub/i },
  jumpup: { good: /hoover|wob|growl|dist|sqr/i },
  halftime: { good: /sub|dark|growl|metal/i },
  trap: { good: /808|trap|bell|flute|choir|dark|dist|pluck/i },
  lofi: { good: /lo-?fi|tape|dusty|soft|\bep\b|wurly|vibe|mellow|warm/i },
  gfunk: { good: /whistle|sine|portament|moog|mg\b|organ|bounce/i },
  drill: { good: /808|slide|dark|choir|string|bell|piano/i },
  neosoul: { good: /\bep\b|rhodes|wurly|organ|soft|warm|jazz/i },
  memphis: { good: /808|cowbell|dark|bell|choir|horror/i },
  phonk: { good: /808|cowbell|dist|dark|bell/i },
  techhouse: { good: /tech|perc|stab|round|sub|minimal|organ/i },
  afrohouse: { good: /marimba|kalimba|log|flute|perc|organ|deep/i },
  classichouse: { good: /m1|organ|piano|house|101|korg|disco/i },
  acidtechno: { good: /\btb\b|acid|303|202|squelch|saw/i },
  speedgarage: { good: /hard house|garage|reese|organ|stab/i },
  riddim: { good: /wob|wub|monster|growl|riddim/i },
  disco: { good: /disco|string|philly|brass|slap|clav|funk/i },
  nudisco: { good: /disco|juno|string|slap|mg\b|moog/i },
  dub: { good: /dub|echo|organ|melodica|sine|sub/i },
  dancehall: { good: /dancehall|808|steel|sine|trap/i },
  afrobeats: { good: /marimba|kalimba|log|steel|guitar|piano/i },
  reggaeton: { good: /808|pluck|piano|guitar|stab/i },
  indie: { good: /wurly|guitar|dist|organ|piano|chorus/i },
  cinematic: { good: /orch|string|brass|choir|cello|pizz|harp|epic|tension|horror/i },
  punk: { good: /dist|grunge|guitar|chunk|power/i }
};
/** How many tones a pool holds at most when it is made from the rules. */
export const POOL_MAX = 24;

/**
 * Score a sound for a job in a genre (higher fits better; null: not for this job).
 * @param {{name:string, cat:string, kind:string}} s
 * @param {string} role
 * @param {{good?:RegExp, bad?:RegExp}[]} words  the genre's, then its family's
 */
export function fitScore(s, role, words) {
  if (role === 'drums') return s.kind === 'kit' ? 1 : null;
  if (s.kind !== 'tone') return null;
  const cats = ROLE_CATS[role] || [],
    ci = cats.indexOf(s.cat),
    named = ROLE_WORDS[role] && ROLE_WORDS[role].test(s.name);
  if (role === 'acid' && !named) return null;
  if (ci < 0 && !named) return null;
  /* a bass named for another job (a "Bass Pad") stays out of the bass pool */
  let n = (ci >= 0 ? 3 - Math.min(2, ci / 4) : 1) + (named ? 1 : 0);
  for (const w of words) {
    if (!w) continue;
    /* each fitting word counts: a "Glass Amb Pad" fits ambient better than a "Horror Pad" */
    if (w.good) n += 4 * Math.min(3, (s.name.match(new RegExp(w.good.source, 'gi')) || []).length);
    if (w.bad && w.bad.test(s.name)) n -= 6;
  }
  return n;
}
