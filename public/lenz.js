// A bounded interaction metaphor for Lenz's law, not a field simulation.
// A Gaussian represents coupling; -d(flux)/dt changes sign on approach/departure.
export function inductionTarget(center, pointer, now, { radius=190, limit=16, enabled=true }={}) {
  const idle={x:0,y:0,strength:0,phase:'idle'};
  if(!enabled||!pointer.active||!Number.isFinite(pointer.time))return idle;
  const age=Math.max(0,now-pointer.time);
  if(age>650)return idle;
  const dx=pointer.x-center.x,dy=pointer.y-center.y,d=Math.hypot(dx,dy);
  if(d<2||d>radius*2.6)return idle;
  const coupling=Math.exp(-(d*d)/(2*radius*radius));
  const radial=(dx*(pointer.vx||0)+dy*(pointer.vy||0))/d;
  const decay=Math.exp(-Math.max(0,age-35)/85);
  const response=Math.tanh(radial*coupling/230)*decay;
  if(Math.abs(response)<.012)return idle;
  return {x:dx/d*response*limit,y:dy/d*response*limit,strength:Math.abs(response),phase:response<0?'approach':'depart'};
}
