import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openStore, passwordHash } from '../lib/store.mjs';

async function hiddenPassword(prompt) {
  stdout.write(prompt);
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let password='';
    const finish=()=>{stdin.removeListener('data',listener);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};
    function listener(chunk) {
      for(const char of chunk) {
        if(char==='\u0003'){finish();reject(new Error('已取消'));return;}
        if(char==='\r'||char==='\n'){finish();resolve(password);return;}
        if(char==='\u007f'||char==='\b'){password=password.slice(0,-1);continue;}
        if(char>=' ')password+=char;
      }
    }
    stdin.on('data',listener);
  });
}
async function input() {
  if(!stdin.isTTY) {
    let raw='';for await(const chunk of stdin){raw+=chunk;if(raw.length>4096)throw new Error('输入过长');}
    return JSON.parse(raw);
  }
  const rl=createInterface({input:stdin,output:stdout});
  const username=await rl.question('管理员账号（字母或数字，至少 3 位）: ');
  const name=await rl.question('管理员显示姓名: ');
  rl.close();
  const password=await hiddenPassword('管理员密码（至少 12 位，输入时不显示）: ');
  const confirm=await hiddenPassword('再次输入密码: ');
  if(password!==confirm)throw new Error('两次密码不一致');
  return {username,name,password};
}
let db;
try {
  const values=await input();
  const username=String(values.username||'').trim().toLowerCase();
  const name=String(values.name||'').trim();
  if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new Error('账号格式不正确');
  if(!name||name.length>60)throw new Error('姓名需为 1–60 个字符');
  if(typeof values.password!=='string'||values.password.length<12||values.password.length>128)throw new Error('密码需要 12–128 个字符');
  db=openStore(process.env.DATA_DIR||join(dirname(dirname(fileURLToPath(import.meta.url))),'data'));
  if(db.prepare('SELECT id FROM users WHERE username=?').get(username))throw new Error('该账号已存在；请使用其他账号名，或在管理页面重设密码');
  db.prepare("INSERT INTO users(username,name,password,role) VALUES (?,?,?,'admin')").run(username,name,passwordHash(values.password));
  console.log('管理员账号已创建。密码不会保存在代码或日志中。');
} catch(error) {console.error(error.message);process.exitCode=1;}
finally{db?.close();}
