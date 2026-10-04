/** Private server facts; only a selected label is delivered to its owner. */
export type VoiceId='R01'|'R02'|'R03'|'R04'|'R05'|'R06'|'R07'|'R08'|'R09'|'R10'|'R17'|'R18'|'R19'|'R20'|'R21';
export interface VoiceFacts {results:VoiceId[];acted:boolean;suppressEmpty:boolean;publicGains?:Array<'fists'|'shields'|'waters'|'cotton'>}
export interface VoiceCue {key:string;id:VoiceId}
export interface ResourceEvent {id:string;playerId:string;resource:'shield'|'water';delta:number;remaining:number;cause:'gain'|'blocked'|'destroyed'|'spent'}
export const VOICE_ORDER:VoiceId[]=['R01','R02','R03','R04','R05','R07','R10','R17','R18','R21','R08','R09','R06','R19','R20'];
export function selectRoundVoice(facts:VoiceFacts):VoiceId|undefined{
  return VOICE_ORDER.find(id=>facts.results.includes(id))??(facts.acted&&!facts.suppressEmpty?'R20':undefined);
}
