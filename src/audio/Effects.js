export class Effects {
  constructor(context){
    this.context=context;
    this.filters=[60,1000,10000].map((frequency,i)=>{const n=context.createBiquadFilter();n.type=i===0?'lowshelf':i===2?'highshelf':'peaking';n.frequency.value=frequency;n.Q.value=.8;return n;});
    this.transitionFilter=context.createBiquadFilter();this.transitionFilter.type='highpass';this.transitionFilter.frequency.value=20;
    this.input=this.filters[0];this.filters[0].connect(this.filters[1]);this.filters[1].connect(this.filters[2]);this.filters[2].connect(this.transitionFilter);this.output=this.transitionFilter;
    this.delay=context.createDelay(1.5);this.feedback=context.createGain();this.wet=context.createGain();
    this.delay.delayTime.value=.28;this.feedback.gain.value=.28;this.wet.gain.value=0;
    this.output.connect(this.delay);this.delay.connect(this.feedback);this.feedback.connect(this.delay);this.delay.connect(this.wet);
  }
  setEQ(band,db){const n=this.filters[band];if(n)n.gain.setTargetAtTime(Number(db),this.context.currentTime,.03);}
  setTransitionFilter(hz){this.transitionFilter.frequency.setTargetAtTime(Math.max(20,Math.min(18000,hz)),this.context.currentTime,.04);}
  setEcho(amount){this.wet.gain.setTargetAtTime(Math.max(0,Math.min(.45,amount)),this.context.currentTime,.04);}
  connect(destination){this.output.connect(destination);this.wet.connect(destination);}
  disconnect(){this.output.disconnect();this.wet.disconnect();this.delay.disconnect();this.feedback.disconnect();}
}