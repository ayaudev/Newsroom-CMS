const fs=require('fs/promises');
const path=require('path');
const os=require('os');
const {spawn}=require('child_process');
const run=(file,args,options={})=>new Promise((resolve,reject)=>{
 const child=spawn(file,args,{...options,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
 child.on('error',reject);child.on('exit',code=>{child.stdout.destroy();child.stderr.destroy();if(code===0)resolve({stdout,stderr});else reject(Object.assign(new Error(file+' exited with '+code),{stdout,stderr}));});
});
async function main(){
 const bin=process.env.POSTGRES_BIN||'C:/Program Files/PostgreSQL/18/bin';
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'newsroom-pg-test-'));
 const data=path.join(dir,'data'),log=path.join(dir,'postgres.log');
 // Private test cluster, bound only to loopback. Never connects to the user's database.
 let started=false;
 try {
  await run(path.join(bin,'initdb.exe'),['-D',data,'-U','newsroom_test','-A','trust','--encoding=UTF8','--locale=C'],{windowsHide:true});
  await run(path.join(bin,'pg_ctl.exe'),['-D',data,'-l',log,'-o','-p 55439 -h 127.0.0.1','-w','start'],{windowsHide:true});started=true;
  await run(path.join(bin,'createdb.exe'),['-h','127.0.0.1','-p','55439','-U','newsroom_test','newsroom_test'],{windowsHide:true});
  const result=await run(process.execPath,['--test','tests/integration.test.js'],{cwd:path.join(__dirname,'..'),windowsHide:true,env:{...process.env,DATABASE_URL:'postgresql://newsroom_test@127.0.0.1:55439/newsroom_test',JWT_SECRET:'isolated-test-secret-which-is-never-used-in-production',NEWSROOM_INTEGRATION:'1'},maxBuffer:1024*1024});
  console.log(result.stdout);if(result.stderr)console.error(result.stderr);
 }catch(error){if(error.stdout)console.log(error.stdout);if(error.stderr)console.error(error.stderr);throw error;}
 finally{if(started)await run(path.join(bin,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true});console.log('Изолированная тестовая база остановлена. Файлы: '+dir);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
