/** Review-only presentation state. This is not a combat resolver. */
export const ENERGY_IDS=['fistThunder','shieldThunder','pointThunder','thunder','smallHeal','bigHeal'] as const;
export type EnergyId=typeof ENERGY_IDS[number];
export type EnergyScenario='cast'|'resolved'|'blocked'|'miss'|'cancelled';
export const isEnergyId=(id:string):id is EnergyId=>(ENERGY_IDS as readonly string[]).includes(id);
export const isHealingEffect=(id:EnergyId)=>id==='smallHeal'||id==='bigHeal';
export const energyVariants=(id:EnergyId):ReadonlyArray<{id:EnergyScenario;name:string;note:string}>=>(isHealingEffect(id)?[
  {id:'cast',name:'发动／等待结算',note:'只展示凝聚的治疗保护，不提前出现回血数字；整回合含延判结束才能恢复。'},
  {id:'resolved',name:'成功回血示例',note:'示例保护保留到整回合末，再显示+1／+2。密集气功会清点，但不会打爆这份治疗。'},
  {id:'blocked',name:'治疗爆裂示例',note:'一次来袭被治疗整体吸收，保护层破裂，不出现回血。不是角色受伤，也不演成永久盾。'},
]:[
  {id:'cast',name:'发动示意',note:'雷纹与对应类别标记展示发动动作，不预报任何玩家受伤。'},
  {id:'resolved',name:'命中示例',note:'这里用“3真伤”作为匹配目标的示例；不表示全场都命中，真实伤害仍按服务器结算。'},
  {id:'miss',name:'无匹配目标',note:'电荷散去，不劈中角色、不出现伤害数字。群体作用排除自己。'},
  {id:'cancelled',name:'动作失效',note:'聚集的雷纹断开并熄灭，不再落雷。互出雷劈时双方失效、双方无伤。'},
]);
export function normalizeEnergyScenario(id:EnergyId,scenario:EnergyScenario):EnergyScenario{
  return energyVariants(id).some(v=>v.id===scenario)?scenario:'cast';
}
const unit=(n:number)=>Math.max(0,Math.min(1,n));
export function energyFrame(id:EnergyId,scenario:EnergyScenario,elapsedMs:number,reducedMotion=false){
  const mode=normalizeEnergyScenario(id,scenario),healing=isHealingEffect(id);
  const time=reducedMotion?(mode==='cast'?1200:mode==='resolved'?3500:2100):Math.min(5000,Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0));
  const charge=unit(time/800),breakAt=healing?1500:850;
  const broken=mode==='blocked'||mode==='cancelled';
  const fracture=broken?unit((time-breakAt)/850):0;
  const healingDone=healing&&mode==='resolved'&&time>=3000;
  const mayStrike=!healing&&(mode==='cast'||mode==='resolved');
  const strike=mayStrike?unit((time-850)/270):0;
  const impact=mayStrike?Math.max(0,Math.min((time-1120)/80,1,(1850-time)/650)):0;
  const damage=!healing&&mode==='resolved'&&time>=1200?3:0;
  const recovery=healingDone?(id==='bigHeal'?2:1):0;
  const shell=healing?(broken?charge*(1-fracture):charge*(healingDone?1-unit((time-3000)/900):1)):0;
  const label=recovery?`+${recovery} 血`:damage?'3 真伤':mode==='blocked'&&time>=1500?'治疗爆裂 · 不回血':mode==='cancelled'&&time>=850?'动作失效':mode==='miss'&&time>=1100?'无匹配目标':healing&&time>=800?'等待整回合结算':'';
  return{time,mode,healing,charge,fracture,strike,impact,damage,recovery,shell,label};
}
