export class StemSeparator {
 constructor({onStatus=()=>{}}={}){this.onStatus=onStatus;this.worker=null;this.busy=false;this.job=0;}
 async separate(blob){
  if(this.busy)throw new Error('Stem separation is already running.');
  this.busy=true;const job=++this.job;
  try{
   this.onStatus('Decoding audio for local AI separation…');
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx)throw new Error('Web Audio API is unavailable.');
   const context=new Ctx({sampleRate:44100});let decoded,audio;
   try{decoded=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
   if(decoded.duration>360)throw new Error('For browser memory safety, AI separation is limited to 6 minutes per track.');
   audio=decoded;
   if(decoded.sampleRate!==44100){if(!window.OfflineAudioContext)throw new Error('This browser cannot resample audio to the AI model rate.');const offline=new OfflineAudioContext(2,Math.ceil(decoded.duration*44100),44100),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();audio=await offline.startRendering();}
   const left=audio.getChannelData(0).slice(),right=(audio.numberOfChannels>1?audio.getChannelData(1):audio.getChannelData(0)).slice(),length=left.length;
   audio=null;decoded=null;
   const buffers=new Map(['drums','bass','other','vocals'].map(role=>[role,new AudioBuffer({length,numberOfChannels:2,sampleRate:44100})]));
   const outputs=new Map([...buffers].map(([role,buffer])=>[role,[buffer.getChannelData(0),buffer.getChannelData(1)]]));
   const weights=new Float32Array(length),segment=343980,overlap=Math.floor(segment/4),stride=segment-overlap,window=new Float32Array(segment).fill(1);
   for(let i=0;i<overlap;i++){const v=i/overlap;window[i]=v;window[segment-1-i]=v;}
   const worker=new Worker(new URL('./StemSeparationWorker.js',import.meta.url),{type:'module'});this.worker=worker;
   const result=await new Promise((resolve,reject)=>{
    worker.onmessage=e=>{const m=e.data;if(m.type==='status'||m.type==='progress'){this.onStatus(m.message,m);return;}if(m.type==='error'){reject(new Error(m.message));return;}if(m.type==='chunk'){for(const stem of m.stems){const target=outputs.get(stem.role);if(!target)continue;const l=new Float32Array(stem.left),r=new Float32Array(stem.right);for(let i=0;i<m.count;i++){const at=m.start+i,w=window[i];target[0][at]+=l[i]*w;target[1][at]+=r[i]*w;}}for(let i=0;i<m.count;i++)weights[m.start+i]+=window[i];return;}if(m.type==='done')resolve(true);};
    worker.onerror=e=>reject(new Error(e.message||'AI separation worker failed.'));
    worker.postMessage({type:'separate',leftBuffer:left.buffer,rightBuffer:right.buffer},[left.buffer,right.buffer]);
   });
   if(!result||job!==this.job)throw new Error('Separation cancelled.');
   for(const [role,channels] of outputs){for(let c=0;c<2;c++)for(let i=0;i<length;i++)channels[c][i]/=Math.max(weights[i],1e-8);}
   this.onStatus('AI stem separation complete.');
   return buffers;
  }finally{this.busy=false;if(this.worker){this.worker.terminate();this.worker=null;}}
 }
 cancel(){this.job++;this.worker?.terminate();this.worker=null;this.busy=false;this.onStatus('AI separation cancelled.');}
}