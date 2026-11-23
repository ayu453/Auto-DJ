export const STEM_ROLES=['vocals','drums','bass','other'];
const roleFor=name=>{const n=name.toLowerCase();return STEM_ROLES.find(role=>new RegExp('(^|[_ .-])'+role+'([_ .-]|$)').test(n))||'other';};
export class StemMixer {
 constructor(deck){this.deck=deck;this.context=deck.context;this.buffers=new Map();this.levels={vocals:1,drums:1,bass:1,other:1};this.sources=[];this.nodes=new Map();}
 async load(files){const next=new Map();for(const file of files){const role=roleFor(file.name);const bytes=await file.arrayBuffer();const buffer=await this.context.decodeAudioData(bytes);next.set(role,buffer);}if(!next.size)throw new Error('No usable stem audio files found.');this.stop();this.buffers=next;if(this.deck.playing)this.start(this.deck.currentTime);return [...next.keys()];}
 start(offset=0){if(!this.buffers.size)return false;this.stop();this.deck.setMediaLevel(0,.025);for(const [role,buffer] of this.buffers){if(offset>=buffer.duration)continue;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=this.levels[role]??1;source.connect(gain);gain.connect(this.deck.effects.input);source.onended=()=>{try{source.disconnect();gain.disconnect();}catch{}};source.start(0,Math.max(0,offset));this.sources.push(source);this.nodes.set(role,gain);}return true;}
 stop(){for(const source of this.sources){try{source.stop();}catch{}try{source.disconnect();}catch{}}this.sources=[];for(const node of this.nodes.values()){try{node.disconnect();}catch{}}this.nodes.clear();}
 setLevel(role,value){if(!STEM_ROLES.includes(role))return;this.levels[role]=Math.max(0,Math.min(1,Number(value)));const node=this.nodes.get(role);if(node)node.gain.setTargetAtTime(this.levels[role],this.context.currentTime,.025);}
 clear(){this.stop();this.buffers.clear();this.deck.setMediaLevel(1,.025);}
 get active(){return this.buffers.size>0;}
 get summary(){return [...this.buffers.keys()];}
}