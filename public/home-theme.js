const modes=['magnetic','landscape','daily'];
export function normalizeThemeMode(value){return modes.includes(value)?value:'magnetic';}
export function homeDateKey(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=type=>parts.find(part=>part.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function resolveHomeTheme(mode,now=new Date()){
  mode=normalizeThemeMode(mode);
  if(mode!=='daily')return mode;
  return Math.floor(Date.parse(homeDateKey(now)+'T00:00:00Z')/86400000)%2===0?'magnetic':'landscape';
}
export function readHomeTheme(storage){try{return normalizeThemeMode(storage.getItem('cimai.home-theme'));}catch{return 'magnetic';}}
export function saveHomeTheme(storage,mode){try{storage.setItem('cimai.home-theme',normalizeThemeMode(mode));return true;}catch{return false;}}
