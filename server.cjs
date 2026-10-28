const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(dataDir, {recursive:true});
fs.mkdirSync(path.join(dataDir,'uploads'), {recursive:true});
const catalogFile = path.join(dataDir,'products.json');
if(!fs.existsSync(catalogFile)) fs.copyFileSync(path.join(root,'products.seed.json'),catalogFile);
let products = JSON.parse(fs.readFileSync(catalogFile));
const categories = ['Pickles','Cookies','Desserts','Drinks','Masalas'];
const sessions = new Map(), attempts = new Map();
const salt = crypto.randomBytes(16);
const password = crypto.scryptSync(process.env.ADMIN_PASSWORD || 'admin123',salt,64);
const username = process.env.ADMIN_USERNAME || 'admin';
const publicFiles = new Set(['index.html','preview-mobile.html','app.js','styles.css','logo.css','favicon.svg','robots.txt','sitemap.xml','admin.html','admin.js','admin.css',...fs.readdirSync(root).filter(f=>/\.(jpe?g|png|webp)$/i.test(f))]);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function fail(status,message){throw Object.assign(new Error(message),{status});}
async function body(req){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>35*1024*1024)fail(413,'Image is too large. Maximum file size is 25 MB.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks));}catch{fail(400,'Invalid request.');}}
function session(req){const token=(req.headers.cookie||'').split('; ').find(c=>c.startsWith('zubis_session='))?.slice(14);const item=sessions.get(token);if(!item||item.expires<Date.now()){sessions.delete(token);return null;}return {token,...item};}
function text(value,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(400,'Please fill all fields within their length limits.');return value.trim();}
function save(){const temp=catalogFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(products,null,2));fs.renameSync(temp,catalogFile);}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');
  try{
    const url=new URL(req.url,'http://localhost');const route=url.pathname;
    if(!['GET','HEAD'].includes(req.method)){
      if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site request rejected.');
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)fail(403,'Cross-site request rejected.');
      if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required.');
    }
    if(route==='/api/products'&&req.method==='GET')return json(res,200,products);
    if(route==='/api/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress;const now=Date.now();const previous=attempts.get(ip);const record=previous&&previous.until>now?previous:{count:0,until:now+15*60*1000};
      if(record.count>=10)fail(429,'Too many attempts. Try again in 15 minutes.');
      const input=await body(req);record.count++;attempts.set(ip,record);
      if(typeof input.password!=='string'||input.password.length>200||input.username!==username||!crypto.timingSafeEqual(password,crypto.scryptSync(input.password,salt,64)))fail(401,'Incorrect username or password.');
      attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{expires:now+8*60*60*1000});
      res.setHeader('Set-Cookie',`zubis_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return json(res,200,{username});
    }
    if(route.startsWith('/api/')){
      const auth=session(req);if(!auth)fail(401,'Please sign in.');
      if(route==='/api/session'&&req.method==='GET')return json(res,200,{username,categories});
      if(route==='/api/logout'&&req.method==='POST'){sessions.delete(auth.token);res.setHeader('Set-Cookie','zubis_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
      if((route==='/api/products'&&req.method==='POST')||(route.startsWith('/api/products/')&&req.method==='PUT')){
        const input=await body(req);const existing=req.method==='PUT'?products.find(p=>p.id===route.slice('/api/products/'.length)):null;
        if(req.method==='PUT'&&!existing)fail(404,'Product not found.');
        const name=text(input.name,100),description=text(input.description,1000);
        if(!categories.includes(input.category))fail(400,'Select a category.');
        if(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>1000000||Math.abs(input.price*100-Math.round(input.price*100))>0.00001)fail(400,'Enter a valid price with up to two decimal places.');
        const x=Number(input.imageX??50),y=Number(input.imageY??50);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)fail(400,'Invalid image position.');
        let image=existing?.image;
        if(input.imageData){
          const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.imageData);if(!match)fail(400,'Use a JPG, PNG or WebP image.');
          const bytes=Buffer.from(match[2],'base64');if(bytes.length>25*1024*1024)fail(413,'Maximum image size is 25 MB.');
          const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
          if(!valid)fail(400,'Invalid image file.');const filename=crypto.randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]);fs.writeFileSync(path.join(dataDir,'uploads',filename),bytes);image='uploads/'+filename;
        }
        if(!existing&&!image)fail(400,'Select a product image.');
        const product={...(existing||{id:crypto.randomUUID(),bg:'#eeeae1',label:''}),name,description,category:input.category,price:input.price,image,imagePosition:`${x}% ${y}%`};
        const old=products;products=existing?products.map(p=>p.id===existing.id?product:p):[...products,product];try{save();}catch(error){products=old;throw error;}
        return json(res,existing?200:201,product);
      }
      fail(404,'Not found.');
    }
    if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
    let file=route==='/'?'index.html':route==='/admin'||route==='/admin/'?'admin.html':route==='/mobile'||route==='/mobile/'?'preview-mobile.html':route.slice(1);let target;
    if(/^uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(file))target=path.join(dataDir,file);
    else if(publicFiles.has(file))target=path.join(root,file);else fail(404,'Not found.');
    if(!fs.existsSync(target))fail(404,'Not found.');
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'text/plain','Cache-Control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});else res.end();}
});
setInterval(()=>{for(const [key,value] of sessions)if(value.expires<Date.now())sessions.delete(key);for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);},60000).unref();
server.listen(Number(process.env.PORT||8082),process.env.HOST||'127.0.0.1',()=>console.log(`Zubi's storefront and admin: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8082}`));
