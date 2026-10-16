import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const source=join(process.env.DATA_DIR||join(root,'data'),'hub.sqlite');
if(!existsSync(source))throw new Error('数据库尚未创建');
const backupDir=process.env.BACKUP_DIR||join(root,'backups');
mkdirSync(backupDir,{recursive:true,mode:0o700});
const target=join(backupDir,`hub-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db=new DatabaseSync(source);
try{await backup(db,target);console.log(target);}finally{db.close();}
