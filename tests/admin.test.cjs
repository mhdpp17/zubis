const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');
test('Admin authentication, product edits, upload persistence and access protection',async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'zubis-test-'));const port=18932;let child;
 async function start(){child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:data},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Server exited '+code)));});}
 let cookie='';const request=(route,method='GET',value,auth=true,extra={})=>fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{}),...extra},...(value===undefined?{}:{body:JSON.stringify(value)})});
 async function stop(){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
 try{await start();assert.equal((await request('/api/products','POST',{},false)).status,401);assert.equal((await request('/api/login','POST',{username:'admin',password:'wrong'},false)).status,401);
 const login=await request('/api/login','POST',{username:'admin',password:'admin123'},false);assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.equal((await request('/api/session')).status,200);
 for(const file of ['/server.cjs','/data/products.json','/products.seed.json','/.git/config'])assert.equal((await request(file)).status,404);
 assert.equal((await request('/api/products','POST',{},true,{Origin:'https://wrong.example'})).status,403);
 const initial=await (await request('/api/products')).json();assert.equal(initial.length,13);
 const imageData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHz0AAAAASUVORK5CYII=';
 const input={name:'Test sweet',description:'A test product',category:'Desserts',price:120,imageData,imageX:50,imageY:65};
 assert.equal((await request('/api/products','POST',{...input,price:-1})).status,400);
 assert.equal((await request('/api/products','POST',{...input,imageData:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
 const createdResponse=await request('/api/products','POST',input);assert.equal(createdResponse.status,201);const created=await createdResponse.json();assert.equal((await request('/'+created.image)).status,200);
 const changed={...input,name:'Edited sweet',price:135,imageData:undefined};assert.equal((await request('/api/products/'+created.id,'PUT',changed)).status,200);
 const original=initial[0];assert.equal((await request('/api/products/'+original.id,'PUT',{...original,description:'Updated existing product',imageX:50,imageY:74})).status,200);
 await stop();await start();const saved=await (await request('/api/products')).json();assert.equal(saved.find(p=>p.id===created.id).price,135);assert.equal(saved.find(p=>p.id===created.id).image,created.image);assert.equal(saved[0].description,'Updated existing product');assert.equal((await request('/api/session')).status,401);
 const again=await request('/api/login','POST',{username:'admin',password:'admin123'},false);cookie=again.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/logout','POST',{})).status,200);assert.equal((await request('/api/products/'+created.id,'PUT',changed)).status,401);
 }finally{if(child&&child.exitCode===null)await stop();fs.rmSync(data,{recursive:true,force:true});}
});
