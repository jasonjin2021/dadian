import type {VoiceId} from './round-feedback.ts';

export const voiceFile=(id:VoiceId)=>`/audio/results/${id}.${id==='R07'||id==='R09'?'wav':'mp3'}`;

interface OutcomeEnvironment {
  context:()=>AudioContext;
  load:(id:VoiceId,context:AudioContext,signal:AbortSignal)=>Promise<AudioBuffer>;
  now:()=>number;
}

const browserEnvironment:OutcomeEnvironment={
  context:()=>{
    const Ctor=window.AudioContext??(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Ctor)throw new Error('当前浏览器不支持语音播放');
    return new Ctor();
  },
  load:async(id,context,signal)=>{
    const response=await fetch(voiceFile(id),{signal});
    if(!response.ok)throw new Error('语音文件暂时无法读取');
    return context.decodeAudioData(await response.arrayBuffer());
  },
  now:()=>performance.now(),
};

/** One quiet channel. In-flight files cannot start after leaving or muting. */
export class OutcomePlayer {
  private context?:AudioContext;
  private source?:AudioBufferSourceNode;
  private gain?:GainNode;
  private request?:AbortController;
  private unlocking?:Promise<void>;
  private generation=0;
  private disposed=false;
  private buffers=new Map<VoiceId,AudioBuffer>();
  private env:OutcomeEnvironment;

  constructor(env:OutcomeEnvironment=browserEnvironment){this.env=env;}

  async unlock(){
    if(this.disposed)return;
    const context=this.context??=this.env.context();
    if(context.state==='running')return;
    if(this.unlocking)return this.unlocking;
    // resume() runs before any await, within the user's click/key gesture.
    const pending=context.resume().then(()=>{
      if(!this.disposed&&context.state!=='running')throw new Error('请点击页面开启声音');
    });
    this.unlocking=pending;
    try{await pending;}finally{if(this.unlocking===pending)this.unlocking=undefined;}
  }

  stop(){
    this.generation++;
    this.request?.abort();this.request=undefined;
    if(this.source){
      try{this.source.stop();}catch{/* Already ended. */}
      this.source.disconnect();
    }
    this.gain?.disconnect();
    this.source=undefined;this.gain=undefined;
  }

  async play(id:VoiceId,availableMs=5000){
    this.stop();const token=this.generation,context=this.context;
    if(this.disposed||!context||context.state!=='running')return false;
    const started=this.env.now();let buffer=this.buffers.get(id);
    if(!buffer){
      const request=new AbortController();this.request=request;
      try{buffer=await this.env.load(id,context,request.signal);}
      catch(error){if(this.disposed||token!==this.generation)return false;throw error;}
      if(this.disposed||token!==this.generation)return false;
      this.buffers.set(id,buffer);this.request=undefined;
    }
    const remaining=(availableMs-(this.env.now()-started))/1000;
    if(this.disposed||token!==this.generation||remaining<.15||context.state!=='running')return false;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
    source.connect(gain);gain.connect(context.destination);
    const t=context.currentTime,duration=Math.min(buffer.duration,remaining);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.16,t+.035);
    gain.gain.setValueAtTime(.16,t+Math.max(.035,duration-.12));gain.gain.linearRampToValueAtTime(0,t+duration);
    source.onended=()=>{
      source.disconnect();gain.disconnect();
      if(this.source===source){this.source=undefined;this.gain=undefined;}
    };
    source.start(t);source.stop(t+duration);
    this.source=source;this.gain=gain;return true;
  }

  dispose(){
    this.disposed=true;this.stop();
    if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});
    this.context=undefined;
  }
}

/** The first loaded result is history, including refreshes midway through a reveal. */
export class OutcomeCueGate {
  private scope?:string;
  private seen=new Set<string>();
  observe(scope:string,key?:string){
    if(this.scope!==scope){
      this.scope=scope;this.seen.clear();
      if(key)this.seen.add(key);
      return false;
    }
    if(!key||this.seen.has(key))return false;
    this.seen.add(key);return true;
  }
}
