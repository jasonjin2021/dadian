import test from 'node:test';
import assert from 'node:assert/strict';
import {ENERGY_IDS,energyFrame,energyVariants,isEnergyId,isHealingEffect,normalizeEnergyScenario} from './energy-effects.ts';

test('新增样稿只包含G四项与I两项；场景按类别隔离',()=>{
  assert.equal(ENERGY_IDS.length,6);
  assert.equal(new Set(ENERGY_IDS).size,6);
  assert.equal(isEnergyId('gun'),false);
  assert.equal(isEnergyId('smallHeal'),true);
  for(const id of ENERGY_IDS){
    assert.deepEqual(energyVariants(id).map(v=>v.id),isHealingEffect(id)?['cast','resolved','blocked']:['cast','resolved','miss','cancelled']);
    assert.equal(normalizeEnergyScenario(id,isHealingEffect(id)?'cancelled':'blocked'),'cast');
  }
});
for(const id of ['smallHeal','bigHeal'] as const){
  test(`${id} 等整回合末示例才回血，发动或爆裂绝不加血`,()=>{
    const amount=id==='smallHeal'?1:2;
    for(const t of [0,400,1000,1499,1500,2000,2999,3000,3500,5000]){
      for(const mode of ['cast','blocked'] as const){
        const f=energyFrame(id,mode,t);assert.equal(f.recovery,0);assert.equal(f.damage,0);assert.equal(f.strike,0);assert.ok(!f.label.includes('+'));
      }
      const f=energyFrame(id,'resolved',t);assert.equal(f.recovery,t<3000?0:amount);assert.equal(f.damage,0);
    }
    assert.equal(energyFrame(id,'blocked',1500).label,'治疗爆裂 · 不回血');
    assert.equal(energyFrame(id,'blocked',2350).shell,0);
    assert.equal(energyFrame(id,'resolved',3500).label,`+${amount} 血`);
    assert.equal(energyFrame(id,'cast',5000).label,'等待整回合结算');
  });
}
for(const id of ['fistThunder','shieldThunder','pointThunder','thunder'] as const){
  test(`${id} 仅人工命中示例显示3真伤，落空和失效不落雷`,()=>{
    for(const t of [0,450,850,1080,1200,1450,2100,5000]){
      for(const mode of ['cast','miss','cancelled'] as const){
        const f=energyFrame(id,mode,t);assert.equal(f.damage,0);assert.equal(f.recovery,0);
        if(mode!=='cast'){assert.equal(f.strike,0);assert.equal(f.impact,0);}
      }
      const f=energyFrame(id,'resolved',t);assert.equal(f.damage,t<1200?0:3);assert.equal(f.recovery,0);
    }
    assert.equal(energyFrame(id,'cancelled',1700).fracture,1);
    assert.equal(energyFrame(id,'cancelled',5000).label,'动作失效');
    assert.equal(energyFrame(id,'miss',5000).label,'无匹配目标');
  });
}
test('重播确定性、五秒上限、非法时间回退与低动态静帧',()=>{
  for(const id of ENERGY_IDS)for(const {id:mode} of energyVariants(id)){
    assert.deepEqual(energyFrame(id,mode,1400),energyFrame(id,mode,1400));
    assert.deepEqual(energyFrame(id,mode,9000),energyFrame(id,mode,5000));
    for(const t of [-10,NaN,Infinity])assert.deepEqual(energyFrame(id,mode,t),energyFrame(id,mode,0));
    assert.deepEqual(energyFrame(id,mode,0,true),energyFrame(id,mode,5000,true));
    for(const t of [0,400,1100,1700,3500,5000]){
      const f=energyFrame(id,mode,t);
      for(const [key,value] of Object.entries(f))if(typeof value==='number')assert.ok(Number.isFinite(value),`${id}.${key} finite`);
      for(const value of [f.charge,f.fracture,f.strike,f.impact,f.shell])assert.ok(value>=0&&value<=1);
    }
  }
});
