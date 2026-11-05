import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Client,LocalAuth} from 'whatsapp-web.js';
import QRCode from 'qrcode';

const base=path.join(os.homedir(),'.peak-whatsapp-bridge');
fs.mkdirSync(base,{recursive:true,mode:0o700});
const tokenPath=path.join(base,'token');
if(!fs.existsSync(tokenPath))fs.writeFileSync(tokenPath,crypto.randomBytes(32).toString('hex'),{mode:0o600});
const token=fs.readFileSync(tokenPath,'utf8').trim();
const statePath=path.join(base,'state.json');
let saved={groupId:'',orders:{}};
try{saved={...saved,...JSON.parse(fs.readFileSync(statePath,'utf8'))}}catch{}
const save=()=>fs.writeFileSync(statePath,JSON.stringify(saved),{mode:0o600});
let qr='',status='starting',lastError='',phone='',groups=[],messages=[];
const classify=body=>{
 const m=body.match(/\b(\d{1,5})\s*contas?\b|\bcontas?\s*(?:de\s*)?(\d{1,5})\b/i);
 const quantity=m?Number(m[1]||m[2]):null;
 return {quantity,order:quantity!==null||/(?:https?:\/\/|www\.)\S+/i.test(body)};
};
const client=new Client({authStrategy:new LocalAuth({clientId:'peak-operator',dataPath:path.join(base,'session')}),puppeteer:{headless:true,args:['--no-first-run','--no-default-browser-check']}});
client.on('qr',async value=>{status='qr';qr=await QRCode.toDataURL(value);});
client.on('authenticated',()=>{status='authenticated';qr='';});
client.on('ready',async()=>{status='ready';qr='';phone=client.info?.wid?.user||'';await loadGroups();});
client.on('auth_failure',error=>{status='error';lastError=String(error);});
client.on('disconnected',reason=>{status='disconnected';lastError=String(reason);phone='';});
async function loadGroups(){const chats=await client.getChats();groups=chats.filter(c=>c.isGroup).map(c=>({id:c.id._serialized,name:c.name}));}
client.on('message',async m=>{
 if(!saved.groupId||m.from!==saved.groupId)return;
 const contact=await m.getContact().catch(()=>null);
 const body=m.body||'',result=classify(body);
 const item={id:m.id._serialized,chatId:m.from,sender:contact?.pushname||contact?.name||m.author||'Participante',phone:(m.author||m.from).split('@')[0],body,at:new Date(m.timestamp*1000).toISOString(),...result};
 if(messages.some(x=>x.id===item.id))return;
 messages=[...messages,item].slice(-300);
 if(result.order&&!saved.orders[item.id]){saved.orders[item.id]={status:'pending',...item};save();}
});
client.initialize().catch(e=>{status='error';lastError=String(e)});
function reply(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${token}`)return reply(res,401,{error:'Unauthorized'});
 let data={};
 try{
  if(req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Payload too large')}
   data=JSON.parse(raw||'{}');
  }
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/status')return reply(res,200,{status,qr,phone,lastError,groupId:saved.groupId,groups});
  if(route==='/groups'){if(status!=='ready')throw Error('WhatsApp desconectado');await loadGroups();return reply(res,200,{groups});}
  if(route==='/select'){if(!groups.some(g=>g.id===data.groupId))throw Error('Grupo não encontrado');saved.groupId=data.groupId;messages=[];save();return reply(res,200,{ok:true});}
  if(route==='/messages')return reply(res,200,{messages,orders:Object.values(saved.orders).filter(o=>o.chatId===saved.groupId)});
  if(route==='/send'){
   if(status!=='ready'||!saved.groupId)throw Error('Conecte o WhatsApp e selecione o grupo');
   if(typeof data.text!=='string'||!data.text.trim()||data.text.length>4000)throw Error('Mensagem inválida');
   await client.sendMessage(saved.groupId,data.text.trim());return reply(res,200,{ok:true});
  }
  if(route==='/order'){
   const order=saved.orders[data.id];if(!order||order.chatId!==saved.groupId)throw Error('Pedido não encontrado');
   if(data.status==='doing'&&order.status==='pending')order.status='doing';
   else if(data.status==='done'&&order.status==='doing')order.status='done';
   else throw Error('Transição inválida');
   save();return reply(res,200,{ok:true});
  }
  return reply(res,404,{error:'Not found'});
 }catch(e){return reply(res,400,{error:String(e.message||e)})}
});
server.listen(38741,'127.0.0.1',()=>console.log('PEAK WhatsApp bridge on localhost:38741'));
process.on('SIGINT',()=>{server.close();client.destroy().finally(()=>process.exit(0))});
