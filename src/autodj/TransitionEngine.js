export class TransitionEngine {
  constructor(mixer,decks,onComplete){this.mixer=mixer;this.decks=decks;this.onComplete=onComplete;this.timer=null;this.running=false;this.token=0;}
  async transition(fromId,toId,seconds=8,plan={style:'bass-swap'}){
    if(this.running)return false;
    const from=this.decks[fromId],to=this.decks[toId];if(!from?.track||!to?.track)return false;
    this.running=true;const token=++this.token;await this.mixer.resume();
    const a=Number(from.track.bpm)||0,b=Number(to.track.bpm)||0;
    const rate=a&&b?a/b:1,matched=rate>=.94&&rate<=1.06;
    to.setRate(matched?rate:1);
    const defaultCue=Math.max(0,Number(to.track.beatOffset)||0);
    const cue=Number.isFinite(plan.incomingCue)&&plan.incomingCue>0?plan.incomingCue:defaultCue;
    to.setCurrentTime(cue);
    this.mixer.setDeckSide(fromId,.001);await to.play();
    const beatsPerBar=4,bars=Math.max(4,Math.min(16,Number(plan.bars)||8));
    const duration=Math.max(5,Math.min(18,a?60/a*beatsPerBar*bars:seconds))*1000,start=performance.now();
    const startValue=fromId==='A'?0:1,endValue=toId==='A'?0:1;
    const fxA=from.effects,fxB=to.effects,filter=!!plan.filterSweep,echo=Math.max(0,Math.min(.4,Number(plan.echo)||0));
    // A real one-bar audio-buffer repeat: the outgoing groove is sampled and
    // looped over the transition, while the original deck is gently ducked.
    const beatSeconds = a ? 60 / a : Number(from.track.beatInterval) || .5;
    const barSeconds = beatSeconds * 4;
    const elapsed = Math.max(0, from.currentTime - (Number(from.track.beatOffset) || 0));
    const loopBar = Math.max(0, Math.floor(elapsed / barSeconds) - 1);
    const loopStart = (Number(from.track.beatOffset) || 0) + loopBar * barSeconds;
    const loopStarted = plan.loopRepeat !== false && from.startLoop(loopStart, barSeconds, 1, .72);
    if (loopStarted) from.setMediaLevel(.48, .04);
    fxA.setEcho(echo);fxB.setEcho(0);
    fxA.setTransitionFilter(20);fxB.setTransitionFilter(filter?18000:20);
    const step=now=>{
      if(!this.running||token!==this.token)return;
      const p=Math.min(1,(now-start)/duration),e=p*p*(3-2*p);
      this.mixer.setCrossfader(startValue+(endValue-startValue)*e,.02);
      if(plan.bassSwap){
        if(p<.5){from.setEQ(0,-12*p);to.setEQ(0,-6*(1-p*2));}
        else{from.setEQ(0,-6-12*((p-.5)*2));to.setEQ(0,-6+6*((p-.5)*2));}
      }
      if(filter){fxA.setTransitionFilter(20+17980*p);fxB.setTransitionFilter(18000-17980*p);}
      if(echo)fxA.setEcho(echo*(1-p));
      if(p<1)this.timer=requestAnimationFrame(step);
      else{
        from.stopLoop(.025);
        from.setMediaLevel(1, .02);
        from.stop();from.setEQ(0,0);to.setEQ(0,0);from.setRate(1);
        fxA.setEcho(0);fxB.setEcho(0);fxA.setTransitionFilter(20);fxB.setTransitionFilter(20);
        this.running=false;this.onComplete?.(fromId,toId,{matched,style:plan.style,plan});
      }
    };
    this.timer=requestAnimationFrame(step);return true;
  }
  cancel(){this.running=false;this.token++;if(this.timer)cancelAnimationFrame(this.timer);this.timer=null;for(const deck of Object.values(this.decks)){deck.stopLoop(0);deck.setMediaLevel(1,.01);}}
}