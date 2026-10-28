export const defaultPowerOptions=Object.freeze({auto:true,interval:8,speed:1,intensity:1,style:'sweep',motion:true});
export function normalizePowerOptions(input){
  const value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const number=(key,min,max)=>typeof value[key]==='number'&&Number.isFinite(value[key])?Math.min(max,Math.max(min,value[key])):defaultPowerOptions[key];
  return {auto:typeof value.auto==='boolean'?value.auto:true,interval:Math.round(number('interval',5,20)),speed:number('speed',.75,1.75),intensity:number('intensity',.4,1.4),style:value.style==='converge'?'converge':'sweep',motion:typeof value.motion==='boolean'?value.motion:true};
}
export function readPowerOptions(storage){try{return normalizePowerOptions(JSON.parse(storage.getItem('cimai.logo-power')));}catch{return normalizePowerOptions();}}
export function savePowerOptions(storage,options){try{storage.setItem('cimai.logo-power',JSON.stringify(normalizePowerOptions(options)));return true;}catch{return false;}}
export function powerTimeline(elapsedMs,options){
  const speed=normalizePowerOptions(options).speed,time=Math.max(0,elapsedMs)/1000*speed;
  return {time,done:elapsedMs>=3450/speed,phase:time<.7?'charging':time<2.05?'discharge':'settling',progress:Math.min(1,Math.max(0,(time-.7)/1.35))};
}
// One timeout per visible homepage. No catch-up bursts after a pause.
export function createPowerCycle({getOptions,canRun,onTrigger,setTimer=setTimeout,clearTimer=clearTimeout}){
  let timer=null,disposed=false;
  function pause(){if(timer!==null)clearTimer(timer);timer=null;}
  function schedule(){
    pause();const options=normalizePowerOptions(getOptions());
    if(disposed||!options.auto||!options.motion||!canRun())return;
    timer=setTimer(()=>{timer=null;if(disposed)return;const current=normalizePowerOptions(getOptions());if(!current.auto||!current.motion)return;if(canRun())onTrigger();schedule();},options.interval*1000);
  }
  return {schedule,pause,dispose(){disposed=true;pause();}};
}
