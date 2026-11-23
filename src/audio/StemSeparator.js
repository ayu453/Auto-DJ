export class StemSeparator {
 constructor({onStatus=()=>{}}={}){this.onStatus=onStatus;this.worker=null;this.busy=false;this.job=0;}
 async separate(blob){
  if(this.busy)throw new Error('Stem separation is already running.');
  this.busy=true;const job=++this.job;
  try{
   this.onStatus('Decoding audio for local AI separation…');
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx)throw new Error('Web Audio API is unavailable.');
   const context=new Ctx({sampleRate:44100});
   let decoded;
   try{decoded=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
   if(decoded.duration>360)throw new Error('For browser memory safety, AI separation is limited to 6 minutes per track.');
   let audio=decoded;
   if(decoded.sampleRate!==44100){const offline=new OfflineAudioContext(2,Math.ceil(decoded.duration*44100),44100),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();audio=await offline.startRendering();}
   const left=audio.getChannelData(0).slice(),right=(audio.numberOfChannels>1?audio.getChannelData(1):audio.getChannelData(0)).slice();
   const worker=new Worker(new URL('./StemSeparationWorker.js',import.meta.url),{type:'module'});this.worker=worker;
   const result=await new Promise((resolve,reject)=>{
    worker.onmessage=e=>{const m=e.data;if(m.type==='status'||m.type==='progress'){this.onStatus(m.message,m);return;}if(m.type==='error'){reject(new Error(m.message));return;}if(m.type==='done')resolve(m);};
    worker.onerror=e=>reject(new Error(e.message||'AI separation worker failed.'));
    worker.postMessage({type:'separate',leftBuffer:left.buffer,rightBuffer:right.buffer,sampleRate:44100},[left.buffer,right.buffer]);
   });
   if(job!==this.job)throw new Error('Separation cancelled.');
   const buffers=new Map();
   for(const stem of result.stems){const buffer=new AudioBuffer({length:result.length,numberOfChannels:2,sampleRate:44100});buffer.copyToChannel(new Float32Array(stem.left),0);buffer.copyToChannel(new Float32Array(stem.right),1);buffers.set(stem.role,buffer);}
   this.onStatus('AI stem separation complete.');
   return buffers;
  }finally{this.busy=false;if(this.worker){this.worker.terminate();this.worker=null;}}
 }
 cancel(){this.job++;this.worker?.terminate();this.worker=null;this.busy=false;this.onStatus('AI separation cancelled.');}
}