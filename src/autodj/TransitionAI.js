// Local adaptive transition director; no cloud API or audio upload.
export class TransitionAI {
  constructor() {
    this.styles = ['clean-blend', 'filter-rise', 'echo-out', 'bass-swap'];
    this.history = new Map();
    this.exploration = 0.34;
  }
  choose(from, to) {
    const a = Number(from?.bpm) || 0, b = Number(to?.bpm) || 0;
    const gap = a && b ? Math.abs(a-b)/Math.max(a,b) : 0.2;
    const sameKey = from?.key && to?.key && from.key === to.key;
    const ranked = this.styles.map(style => {
      const h = this.history.get(style) || {score:0.5,count:0};
      let fit = style === 'clean-blend' ? 0.62-gap*0.8 :
        style === 'filter-rise' ? 0.58-gap*0.2 :
        style === 'echo-out' ? 0.48+(gap>0.035?0.15:0) :
        0.54+(sameKey?0.12:0);
      return {style, score:fit+(h.score-0.5)*0.3};
    }).sort((x,y)=>y.score-x.score);
    const explore = Math.random() < this.exploration;
    const pool = explore ? ranked.slice(0,4) : ranked.slice(0,1);
    const picked = pool[Math.floor(Math.random()*pool.length)];
    return {style:picked.style, confidence:Math.max(0,Math.min(1,picked.score)), reason:explore?'AI experiment':'best-fit prediction'};
  }
  learn(style, rating) {
    const old=this.history.get(style)||{score:0.5,count:0};
    const count=old.count+1;
    this.history.set(style,{score:old.score+(rating-old.score)/count,count});
  }
}