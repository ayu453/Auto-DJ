export class TransitionEngine {
  constructor(mixer,decks,onComplete){this.mixer=mixer;this.decks=decks;this.onComplete=onComplete;this.timer=null;this.running=false;this.token=0;}
  async transition(fromId,toId,seconds=8,plan={style:'bass-swap'}){
    if(this.running)return false;
    const from=this.decks[fromId],to=this.decks[toId];if(!from?.track||!to?.track)return false;
    this.running=true;const token=++this.token;await this.mixer.resume();
    const style=plan.style||'bass-swap',a=Number(from.track.bpm)||0,b=Number(to.track.bpm)||0;
    const rate=a&&b?a/b:1,matched=rate>=.94&&rate<=1.06;to.setRate(matched?rate:1);
    to.setCurrentTime(Math.max(0,Number(to.track.beatOffset)||0));
    this.mixer.setDeckSide(fromId,.001);await to.play();
    const duration=Math.max(5,Math.min(14,a?60/a*16:seconds))*1000,start=performance.now();
    const startValue=fromId==='A'?0:1,endValue=toId==='A'?0:1,fxA=from.effects,fxB=to.effects;
    fxA.setEcho(style==='echo-out'?.34:0);fxB.setEcho(0);
    fxA.setTransitionFilter(style==='filter-rise'?18000:20);fxB.setTransitionFilter(style==='filter-rise'?18000:20);
    const step=now=>{
      if(!this.running||token!==this.token)return;
      const p=Math.min(1,(now-start)/duration),e=p*p*(3-2*p);
      this.mixer.setCrossfader(startValue+(endValue-startValue)*e,.02);
      if(style==='bass-swap'||style==='clean-blend'){
        if(p<.5){from.setEQ(0,-12*p);to.setEQ(0,-6*(1-p*2));}
        else{from.setEQ(0,-6-12*((p-.5)*2));to.setEQ(0,-6+6*((p-.5)*2));}
      }
      if(style==='filter-rise'){fxA.setTransitionFilter(20+17980*p);fxB.setTransitionFilter(18000-17980*p);}
      if(style==='echo-out')fxA.setEcho(.34*(1-p));
      if(p<1)this.timer=requestAnimationFrame(step);
      else{
        from.stop();from.setEQ(0,0);to.setEQ(0,0);from.setRate(1);
        fxA.setEcho(0);fxB.setEcho(0);fxA.setTransitionFilter(20);fxB.setTransitionFilter(20);
        this.running=false;this.onComplete?.(fromId,toId,{matched,style,plan});
      }
    };
    this.timer=requestAnimationFrame(step);return true;
  }
  cancel(){this.running=false;this.token++;if(this.timer)cancelAnimationFrame(this.timer);this.timer=null;}
}