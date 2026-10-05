import { spawn } from 'node:child_process';
const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{stdio:'inherit'});
build.on('exit',code=>{
 if(code){process.exitCode=code;return;}
 const server=spawn(process.execPath,['--env-file-if-exists=.env','server/index.mjs'],{stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill(signal));
 server.on('exit',code=>{process.exitCode=code||0;});
});

