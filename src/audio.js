export class AudioDeck {
  constructor(id,ctx,destination){
    this.id=id;this.ctx=ctx;this.destination=destination;this.audio=new Audio();this.audio.preload='auto';this.audio.crossOrigin='anonymous';
    this.source=ctx.createMediaElementSource(this.audio);this.gain=ctx.createGain();this.eq=[60,1000,10000].map(f=>{const n=ctx.createBiquadFilter();n.type=f===60?'lowshelf':f===10000?'highshelf':'peaking';n.frequency.value=f;n.Q.value=.8;return n;});
    this.source.connect(this.eq[0]);this.eq[0].connect(this.eq[1]);this.eq[1].connect(this.eq[2]);this.eq[2].connect(this.gain);this.gain.connect(destination);
    this.audio.addEventListener('ended',()=>this.onEnded?.());this.track=null;this.url=null;this.baseBpm=0;this.playing=false;
  }
  load(track){this.stop();if(this.url)URL.revokeObjectURL(this.url);this.track=track;this.url=URL.createObjectURL(track.blob);this.audio.src=this.url;this.baseBpm=track.bpm||0;this.audio.load();}
  async play(){await this.ctx.resume();await this.audio.play();this.playing=true;}
  pause(){this.audio.pause();this.playing=false;}
  stop(){this.audio.pause();this.audio.currentTime=0;this.playing=false;}
  setVolume(v){this.gain.gain.setTargetAtTime(Math.max(0,Math.min(1,v)),this.ctx.currentTime,.025);}
  setEQ(band,value){this.eq[band].gain.setTargetAtTime(value,this.ctx.currentTime,.03);}
  setRate(rate){this.audio.playbackRate=Math.max(.8,Math.min(1.2,rate));}
  setCurrentTime(t){if(Number.isFinite(this.audio.duration))this.audio.currentTime=Math.max(0,Math.min(this.audio.duration,t));}
  get currentTime(){return this.audio.currentTime||0;} get duration(){return this.audio.duration||0;}
  dispose(){this.stop();if(this.url)URL.revokeObjectURL(this.url);}
}
export class AudioMixer{
  constructor(){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-8;this.compressor.knee.value=10;this.compressor.ratio.value=4;this.compressor.attack.value=.004;this.compressor.release.value=.18;this.master.connect(this.compressor);this.compressor.connect(this.ctx.destination);this.decks={A:new AudioDeck('A',this.ctx,this.master),B:new AudioDeck('B',this.ctx,this.master)};this.crossfader=.5;this.setCrossfader(.5);}
  setCrossfader(v){this.crossfader=Math.max(0,Math.min(1,v));const a=Math.cos(this.crossfader*Math.PI/2),b=Math.sin(this.crossfader*Math.PI/2);this.decks.A.setVolume(a);this.decks.B.setVolume(b);}
  setMaster(v){this.master.gain.setTargetAtTime(v,this.ctx.currentTime,.03);}
  async resume(){if(this.ctx.state!=='running')await this.ctx.resume();}
  destroy(){Object.values(this.decks).forEach(d=>d.dispose());this.ctx.close();}
}
export async function analyzeFile(file){
  const ctx=new (window.AudioContext||window.webkitAudioContext)();try{
    const buffer=await ctx.decodeAudioData(await file.arrayBuffer());const data=buffer.getChannelData(0);const sr=buffer.sampleRate;
    const hop=512, frame=1024, energies=[];
    for(let i=0;i+frame<data.length;i+=hop){let e=0;for(let j=0;j<frame;j+=4){const x=data[i+j];e+=x*x;}energies.push(Math.sqrt(e/(frame/4)));}
    const flux=energies.map((v,i)=>Math.max(0,v-(energies[i-1]||0)));
    const minLag=Math.floor(60*sr/(hop*180)),maxLag=Math.ceil(60*sr/(hop*65));let bestLag=0,best=-1;
    for(let lag=minLag;lag<=maxLag;lag++){let score=0;for(let i=lag;i<flux.length;i++)score+=flux[i]*flux[i-lag];if(score>best){best=score;bestLag=lag;}}
    let bpm=bestLag?60*sr/(hop*bestLag):0;if(bpm&&bpm<75)bpm*=2;if(bpm>170)bpm/=2;
    return {duration:buffer.duration,bpm:bpm?Math.round(bpm):0};
  }finally{ctx.close();}
}
