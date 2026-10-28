export function homeDateKey(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=type=>parts.find(part=>part.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function resolveHomeTheme(now=new Date()){
  const weekday=new Date(homeDateKey(now)+'T00:00:00Z').getUTCDay();
  return weekday===0||weekday===6?'landscape':'magnetic';
}
