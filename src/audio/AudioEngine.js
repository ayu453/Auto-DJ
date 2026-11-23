import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';
export class AudioEngine {
 constructor(){const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('Web Audio API is not supported.');this.context=new Ctx();this.workletReady=false;this.workletError=null;this.masterInput=this.context.createGain();this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-8;this.compressor.knee.value=10;this.compressor.ratio.value=4;this.compressor.attack.value=.004;this.compressor.release.value=.18;this.masterInput.connect(this.compressor);this.compressor.connect(this.context.destination);this.recordDestination=this.context.createMediaStreamDestination();this.compressor.connect(this.recordDestination);this.cueInput=this.context.createGain();this.cueDestination=this.context.createMediaStreamDestination();this.cueInput.connect(this.cueDestination);}
 async initialize(){if(!this.context.audioWorklet||!window.isSecureContext){this.workletError=new Error('AudioWorklet requires secure context.');return false;}try{await SoundTouchNode.register(this.context,processorUrl);this.workletReady=true;}catch(error){this.workletError=error;console.warn('Time-stretch worklet unavailable.',error);}return this.workletReady;}
 createTimeStretchNode(){return this.workletReady?new SoundTouchNode({context:this.context}):null;}
 async resume(){if(this.context.state!=='running')await this.context.resume();}
 destroy(){if(this.context.state!=='closed')return this.context.close();}
}