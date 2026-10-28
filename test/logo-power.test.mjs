import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPowerOptions,normalizePowerOptions,readPowerOptions,savePowerOptions,powerTimeline,createPowerCycle } from '../public/logo-power.js';

test('通电参数：默认自动每八秒，损坏或越界设置不会产生过快循环',()=>{
  assert.deepEqual(normalizePowerOptions(),defaultPowerOptions);
  assert.deepEqual(normalizePowerOptions(null),defaultPowerOptions);
  const options=normalizePowerOptions({auto:false,interval:-1,speed:999,intensity:Infinity,style:'bad',motion:false});
  assert.equal(options.auto,false);assert.equal(options.interval,5);assert.equal(options.speed,1.75);assert.equal(options.intensity,1);assert.equal(options.style,'sweep');assert.equal(options.motion,false);
  assert.equal(powerTimeline(3450/.75,{speed:.75}).done,true);
  assert.equal(powerTimeline(500,{speed:1.75}).phase,'discharge');
});
test('通电偏好安全保存，存储被禁用或内容损坏时仍可使用',()=>{
  let value='broken';const storage={getItem:()=>value,setItem:(_,next)=>{value=next;}};
  assert.deepEqual(readPowerOptions(storage),defaultPowerOptions);
  assert.equal(savePowerOptions(storage,{auto:false,interval:12,style:'converge'}),true);
  assert.equal(readPowerOptions(storage).auto,false);assert.equal(readPowerOptions(storage).interval,12);assert.equal(readPowerOptions(storage).style,'converge');
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(readPowerOptions(blocked),defaultPowerOptions);assert.equal(savePowerOptions(blocked,{}),false);
});
test('自动通电：单一定时器、手动重排、暂停不补播、关闭和销毁后停止',()=>{
  const pending=new Map();let next=0,options={...defaultPowerOptions},visible=true,count=0;
  const cycle=createPowerCycle({getOptions:()=>options,canRun:()=>visible,onTrigger:()=>{count++;},setTimer:(fn,delay)=>{pending.set(++next,{fn,delay});return next;},clearTimer:id=>pending.delete(id)});
  const fire=()=>{const [id,job]=[...pending][0];pending.delete(id);job.fn();};
  cycle.schedule();cycle.schedule();assert.equal(pending.size,1);assert.equal([...pending.values()][0].delay,8000);
  fire();assert.equal(count,1);assert.equal(pending.size,1);
  visible=false;fire();assert.equal(count,1);assert.equal(pending.size,0);
  visible=true;options.interval=12;cycle.schedule();assert.equal([...pending.values()][0].delay,12000);
  cycle.pause();assert.equal(pending.size,0);
  options.auto=false;cycle.schedule();assert.equal(pending.size,0);
  options.auto=true;options.motion=false;cycle.schedule();assert.equal(pending.size,0);
  options.motion=true;cycle.schedule();cycle.dispose();assert.equal(pending.size,0);cycle.schedule();assert.equal(pending.size,0);
});
