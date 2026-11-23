// On-device adaptive transition planner. Uses local track metadata and session feedback.
export class TransitionAI {
  constructor() {
    this.recipes = [
      { style: 'phrase-blend', remix: 'bar-loop', loopBeats: 4, loopBars: 2, filter: false, echo: 0, bass: true, bars: 8 },
      { style: 'filter-rise', remix: 'bar-loop', loopBeats: 4, loopBars: 2, filter: true, echo: 0, bass: false, bars: 8 },
      { style: 'echo-out', remix: 'bar-loop', loopBeats: 4, loopBars: 1, filter: false, echo: .34, bass: false, bars: 8 },
      { style: 'filter-echo', remix: 'bar-loop', loopBeats: 4, loopBars: 2, filter: true, echo: .25, bass: false, bars: 8 },
      { style: 'energy-lift', remix: 'build-up', loopBeats: 2, loopBars: 2, filter: true, echo: .12, bass: true, bars: 16 },
      { style: 'drop-blend', remix: 'drop-release', loopBeats: 4, loopBars: 1, filter: false, echo: .12, bass: true, bars: 8 },
      { style: 'beat-roll', remix: 'beat-roll', loopBeats: 1, loopBars: 2, filter: true, echo: 0, bass: false, bars: 8 },
      { style: 'half-beat-stutter', remix: 'stutter', loopBeats: .5, loopBars: 2, filter: false, echo: .08, bass: true, bars: 8 }
    ];
    this.history = new Map();
    this.exploration = .32;
  }

  choose(from, to) {
    const a = Number(from?.bpm) || 0, b = Number(to?.bpm) || 0;
    const gap = a && b ? Math.abs(a - b) / Math.max(a, b) : .2;
    const sameKey = !!(from?.key && to?.key && from.key === to.key);
    const outEnergy = Number(from?.structure?.energy) || .5;
    const inEnergy = Number(to?.structure?.energy) || .5;
    const sections = to?.structure?.sections || [];
    const drop = sections.find(s => s.section === 'high-energy' &&
      s.start > Math.max(8, (to.duration || 180) * .18) &&
      s.start < (to.duration || 180) * .72);

    const candidates = this.recipes.map(recipe => {
      const previous = this.history.get(recipe.style) || { score: .5, count: 0 };
      let score = .56 - gap * .5 + (sameKey ? .08 : 0);
      if (recipe.remix === 'drop-release') score += drop ? .15 : -.08;
      if (recipe.remix === 'build-up') score += inEnergy < outEnergy ? .13 : .02;
      if (recipe.remix === 'beat-roll' || recipe.remix === 'stutter') score += gap < .045 ? .04 : -.04;
      if (recipe.style === 'phrase-blend') score += gap < .025 ? .1 : 0;
      if (recipe.style.includes('echo')) score += gap > .035 ? .06 : 0;
      score += (previous.score - .5) * .25;
      return { ...recipe, score };
    }).sort((x, y) => y.score - x.score);

    const explore = Math.random() < this.exploration;
    const pool = explore ? candidates.slice(0, 5) : candidates.slice(0, 1);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const cue = picked.remix === 'drop-release' && drop ? drop.start : 0;
    const beat = b ? 60 / b : 0;
    const alignedCue = beat ? Math.max(0, Math.round(cue / beat) * beat) : cue;

    return {
      style: picked.style, remix: picked.remix,
      confidence: Math.max(0, Math.min(1, picked.score)),
      reason: explore ? 'testing a creative remix recipe' : 'best musical-fit recipe',
      bars: picked.bars, filterSweep: picked.filter, echo: picked.echo,
      bassSwap: picked.bass, loopRepeat: true,
      loopBeats: picked.loopBeats, loopBars: picked.loopBars,
      incomingCue: alignedCue, usesDrop: !!(picked.remix === 'drop-release' && drop),
      energyMatch: Math.round((1 - Math.abs(outEnergy - inEnergy)) * 100)
    };
  }

  learn(style, rating) {
    const old = this.history.get(style) || { score: .5, count: 0 };
    const count = old.count + 1;
    this.history.set(style, { score: old.score + (rating - old.score) / count, count });
  }
}
