import test from 'node:test';
import assert from 'node:assert/strict';
import { inductionTarget } from '../public/lenz.js';
import { homeDateKey,resolveHomeTheme } from '../public/home-theme.js';

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
test('首页按北京时间工作日显示磁脉、周末显示山水，跨时区边界正确',()=>{
  assert.equal(homeDateKey(new Date('2026-10-30T16:00:00Z')),'2026-10-31');
  for(const input of ['2026-10-27T00:01:00+08:00','2026-10-30T23:59:59+08:00','2026-11-02T00:00:00+08:00'])assert.equal(resolveHomeTheme(new Date(input)),'magnetic');
  for(const input of ['2026-10-31T00:00:00+08:00','2026-11-01T23:59:59+08:00'])assert.equal(resolveHomeTheme(new Date(input)),'landscape');
  assert.equal(resolveHomeTheme(new Date('2026-10-30T16:00:00Z')),'landscape');
  assert.equal(resolveHomeTheme(new Date('2026-11-01T16:00:00Z')),'magnetic');
});
