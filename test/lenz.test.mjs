import test from 'node:test';
import assert from 'node:assert/strict';
import { inductionTarget } from '../public/lenz.js';
import { homeDateKey,normalizeThemeMode,resolveHomeTheme,readHomeTheme,saveHomeTheme } from '../public/home-theme.js';

test('来拒去留：同一位置改变径向速度，响应方向反转且有上限',()=>{
  const center={x:200,y:200},pointer={active:true,x:100,y:200,vx:650,vy:0,time:100};
  const approach=inductionTarget(center,pointer,100);
  assert.equal(approach.phase,'approach');assert.ok(approach.x>0);assert.ok(Math.abs(approach.y)<1e-9);
  const depart=inductionTarget(center,{...pointer,vx:-650},100);
  assert.equal(depart.phase,'depart');assert.ok(depart.x<0);
  assert.ok(Math.hypot(approach.x,approach.y)<=16);
  assert.equal(inductionTarget(center,{...pointer,vx:0,vy:500},100).phase,'idle');
});
test('静止、移出、关闭动效和陈旧输入都不会持续驱动',()=>{
  const c={x:200,y:200},p={active:true,x:100,y:200,vx:650,vy:0,time:100};
  assert.ok(inductionTarget(c,p,450).strength<inductionTarget(c,p,100).strength);
  assert.equal(inductionTarget(c,p,900).strength,0);
  assert.equal(inductionTarget(c,{...p,vx:0},100).strength,0);
  assert.equal(inductionTarget(c,{...p,active:false},100).strength,0);
  assert.equal(inductionTarget(c,p,100,{enabled:false}).strength,0);
  assert.equal(inductionTarget(c,{...p,x:200},100).strength,0);
});
test('首页外观：固定选择、北京时间逐日交替、同一天保持一致',()=>{
  const morning=new Date('2026-10-27T00:01:00+08:00'),evening=new Date('2026-10-27T23:59:00+08:00');
  assert.equal(homeDateKey(morning),'2026-10-27');assert.equal(homeDateKey(new Date('2026-10-26T16:00:00Z')),'2026-10-27');
  assert.equal(resolveHomeTheme('daily',morning),resolveHomeTheme('daily',evening));
  assert.notEqual(resolveHomeTheme('daily',morning),resolveHomeTheme('daily',new Date('2026-10-28T00:01:00+08:00')));
  assert.equal(resolveHomeTheme('magnetic',morning),'magnetic');assert.equal(resolveHomeTheme('landscape',morning),'landscape');
  assert.equal(normalizeThemeMode('broken'),'magnetic');
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readHomeTheme(blocked),'magnetic');assert.equal(saveHomeTheme(blocked,'daily'),false);
});
