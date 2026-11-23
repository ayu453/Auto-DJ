// On-device adaptive transition planner. It uses local BPM/key/energy metadata only.
export class TransitionAI {
  constructor(){
    this.recipes=[
      {style:'phrase-blend',filter:false,echo:0,bass:true,bars:8},
      {style:'filter-rise',filter:true,echo:0,bass:false,bars:8},
      {style:'echo-out',filter:false,echo:.34,bass:false,bars:8},
      {style:'filter-echo',filter:true,echo:.25,bass:false,bars:8},
      {style:'energy-lift',filter:true,echo:0,bass:true,bars:16},
      {style:'drop-blend',filter:false,echo:.12,bass:true,bars:8}
    ];
    this.history=new Map();this.exploration=.3;
  }
  choose(from,to){
    const a=Number(from?.bpm)||0,b=Number(to?.bpm)||0;
    const gap=a&&b?Math.abs(a-b)/Math.max(a,b):.2;
    const sameKey=!!(from?.key&&to?.key&&from.key===to.key);
    const outEnergy=Number(from?.structure?.energy)||.5,inEnergy=Number(to?.structure?.energy)||.5;
    const drop=to?.structure?.sections?.find(s=>s.section==='high-energy'&&s.start>Math.max(8,(to.duration||180)*.18)&&s.start<(to.duration||180)*.72);
    const candidates=this.recipes.map(recipe=>{
      const previous=this.history.get(recipe.style)||{score:.5,count:0};
      let score=.58-gap*.5+(sameKey?.08:0);
      if(recipe.style==='drop-blend')score+=drop?.12:0;
      if(recipe.style==='energy-lift')score+=(inEnergy<outEnergy?.12:0);
      if(recipe.style==='echo-out'||recipe.style==='filter-echo')score+=(gap>.035?.08:0);
      if(recipe.style==='phrase-blend')score+=(gap<.025?.1:0);
      score+=(previous.score-.5)*.3;
      return {...recipe,score};
    }).sort((x,y)=>y.score-x.score);
    const explore=Math.random()<this.exploration;
    const pool=explore?candidates.slice(0,4):candidates.slice(0,1);
    const picked=pool[Math.floor(Math.random()*pool.length)];
    const cue= picked.style==='drop-blend'&&drop ? drop.start : Math.max(0,Number(to?.structure?.introEnd)||0);
    const beat= b?60/b:0;
    const alignedCue=beat?Math.max(0,Math.round(cue/beat)*beat):cue;
    return {
      style:picked.style,confidence:Math.max(0,Math.min(1,picked.score)),
      reason:explore?'testing a new effect combination':'best musical-fit recipe',
      bars:picked.bars,filterSweep:picked.filter,echo:picked.echo,bassSwap:picked.bass,
      incomingCue:alignedCue,usesDrop:!!(picked.style==='drop-blend'&&drop),
      energyMatch:Math.round((1-Math.abs(outEnergy-inEnergy))*100)
    };
  }
  learn(style,rating){
    const old=this.history.get(style)||{score:.5,count:0},count=old.count+1;
    this.history.set(style,{score:old.score+(rating-old.score)/count,count});
  }
}