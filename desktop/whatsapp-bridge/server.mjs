import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import WhatsApp from 'whatsapp-web.js';
const {Client,LocalAuth}=WhatsApp;
import QRCode from 'qrcode';

const operatorId=process.env.PEAK_OPERATOR_ID||'local';
if(!/^[a-zA-Z0-9_-]{1,32}$/.test(operatorId))throw Error('Identificador de operador inválido');
const base=process.env.PEAK_DATA_DIR?path.resolve(process.env.PEAK_DATA_DIR):path.join(os.homedir(),'.peak-whatsapp-bridge',operatorId);
fs.mkdirSync(base,{recursive:true,mode:0o700});
const tokenPath=path.join(base,'token');
if(!fs.existsSync(tokenPath))fs.writeFileSync(tokenPath,crypto.randomBytes(32).toString('hex'),{mode:0o600});
const token=fs.readFileSync(tokenPath,'utf8').trim();
const port=Number(process.env.PEAK_PORT||38741);
const bind=process.env.PEAK_BIND||'127.0.0.1';
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta inválida');
if(!/^(127\.0\.0\.1|100\.(?:[0-9]{1,3}\.){2}[0-9]{1,3})$/.test(bind))throw Error('Use loopback ou IP Tailscale 100.x.y.z');
const statePath=path.join(base,'state.json');
let saved={groupId:'',orders:{},knownGroups:[]};
try{saved={...saved,...JSON.parse(fs.readFileSync(statePath,'utf8'))}}catch{}
const save=()=>fs.writeFileSync(statePath,JSON.stringify(saved),{mode:0o600});
let qr='',status='starting',lastError='',phone='',groups=Array.isArray(saved.knownGroups)?saved.knownGroups:[],messages=[];
let groupsLoading=null;
let lastGroupAttempt=0;
const GROUP_REFRESH_COOLDOWN_MS=30000;
const DRAGAO=['XW','888','DY','WE','DZ','OKOK','ANJO','AJ','777','A8','VOY','W1','91','EK','WP','M9','RF'];
const PINGUIM=['MANGA','T1','BOI','MK','Y8','AM','AE','BRA','AA','SQ','M8','GAME','SE','555'];
function priceDetails(order,manual){
 if(order.edit){const e=order.edit;const rows=e.rows.filter(x=>x.quantity>0);if(!rows.length)throw Error('Informe ao menos uma faixa com quantidade');if(rows.some(x=>!Number.isFinite(x.unit)||x.unit<=0))throw Error('Informe o preço unitário de todas as faixas antes de responder');return {group:e.group,quantity:rows.reduce((n,x)=>n+x.quantity,0),rows,total:rows.reduce((n,x)=>n+x.quantity*x.unit,0)};}
 const body=String(order.body||'');
 const urls=body.match(/https?:\/\/[^\s]+/gi)||[];
 const hostTokens=urls.flatMap(url=>{try{return new URL(url).hostname.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)}catch{return []}});
 const tokens=body.toUpperCase().replace(/https?:\/\/[^\s]+/gi,' ').split(/[^A-Z0-9]+/).filter(Boolean);
 const found=[...new Set([...hostTokens,...tokens].flatMap(token=>[...DRAGAO,...PINGUIM].filter(name=>token===name||token.startsWith(name+'-')||token.startsWith(name+'PG')||token.startsWith(name+'SMILING'))))];
 const groups=[...new Set(found.map(name=>DRAGAO.includes(name)?'dragao':'pinguim'))];
 const group=manual==='dragao'||manual==='pinguim'?manual:groups.length===1?groups[0]:null;
 if(!group)throw Error('Não foi possível identificar Dragão ou Pinguim. Selecione manualmente.');
 const quantity=Number(order.quantity);
 if(!Number.isSafeInteger(quantity)||quantity<=0)throw Error('Quantidade de contas não identificada');
 const deposit=body.match(/(?:dep[oó]sitos?\s*(?:de|d[eo])?\s*|contas?\s*(?:de|d[eo])\s*)(?:R\$\s*)?(\d{1,2})(?!\d)/i);
 if(!deposit)throw Error('Valor do depósito não identificado. Informe na mensagem para calcular');
 const amount=Number(deposit[1]);
 let unit;
 if(group==='dragao')unit=amount===10?5:amount>=11&&amount<=15?7:amount>=16&&amount<=18?9:null;
 else unit=amount===10?6:amount>=11&&amount<=13?8:null;
 if(unit===null)throw Error('Faixa de depósito não contemplada na tabela de '+group);
 return {group,quantity,deposit:amount,unit,total:quantity*unit};
}
function makeComanda(total){return '📌 PIX CELULAR\n💠 81995882238\n🏷️ MICAEL RICARDO\n\n────────────\n\n💸 '+total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'\n⚠️ MARCAR E ENVIAR O COMPROVANTE\n\n────────────\n\n⏱️ Prazo para conclusão: de 30 min a 1h após o envio do comprovante.';}
const classify=body=>{
 const m=body.match(/\b(\d{1,5})\s*contas?\b|\bcontas?\s*(?:de\s*)?(\d{1,5})\b/i);
 const quantity=m?Number(m[1]||m[2]):null;
 return {quantity,order:quantity!==null||/(?:https?:\/\/|www\.)\S+/i.test(body)};
};
const chromeRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'puppeteer-cache','chrome');
function locateChrome(dir,depth=0){
 if(depth>5||!fs.existsSync(dir))return '';
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  if(item.isFile()&&item.name==='chrome.exe')return full;
  if(item.isDirectory()){const found=locateChrome(full,depth+1);if(found)return found}
 }
 return '';
}
const windowsChromePaths=process.platform==='win32'?[
 process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google','Chrome','Application','chrome.exe'),
 process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Google','Chrome','Application','chrome.exe'),
 process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe')
].filter(Boolean):[];
const chromeCandidates=[
 process.env.PEAK_CHROME_PATH,
 ...windowsChromePaths,
 locateChrome(chromeRoot)
].filter(Boolean);
const executablePath=chromeCandidates.find(candidate=>fs.existsSync(candidate))||'';
console.log('PEAK bridge startup; Chromium:',executablePath||'Puppeteer default');
const client=new Client({authStrategy:new LocalAuth({clientId:'peak-'+operatorId,dataPath:path.join(base,'session')}),puppeteer:{headless:true,...(executablePath?{executablePath}:{}),args:['--no-first-run','--no-default-browser-check']}});
client.on('qr',async value=>{status='qr';qr=await QRCode.toDataURL(value);});
client.on('authenticated',()=>{status='authenticated';qr='';});
client.on('ready',()=>{status='ready';qr='';phone=client.info?.wid?.user||'';void refreshGroups();});
client.on('auth_failure',error=>{status='error';lastError=String(error);});
client.on('disconnected',reason=>{status='disconnected';lastError=String(reason);phone='';});
async function loadGroups(){const chats=await client.getChats();const fresh=chats.filter(c=>c.isGroup).map(c=>({id:c.id._serialized,name:c.name}));groups=[...fresh,...groups.filter(g=>!fresh.some(x=>x.id===g.id))];saved.knownGroups=groups;save();lastError='';}
function refreshGroups(){
 if(status!=='ready'||groupsLoading)return groupsLoading;
 if(Date.now()-lastGroupAttempt<GROUP_REFRESH_COOLDOWN_MS)return null;
 lastGroupAttempt=Date.now();
 groupsLoading=loadGroups().catch(e=>{
  const detail=e?.stack||e?.message||String(e);
  lastError='Falha ao carregar grupos: '+String(e?.message||e);
  console.error('PEAK groups error:',detail);
  console.error('PEAK groups context:',JSON.stringify({status,chrome:executablePath||'default',operatorId}));
 }).finally(()=>{groupsLoading=null});
 return groupsLoading;
}
function captureMessage(m){
 try{
  const outgoing=Boolean(m.fromMe);
  const chatId=outgoing?m.to:m.from;
  if(typeof chatId!=='string'||!chatId.endsWith('@g.us'))return;
  if(!groups.some(g=>g.id===chatId)){
   const name='Grupo '+chatId.split('@')[0];
   groups=[...groups,{id:chatId,name}];saved.knownGroups=groups;save();
   console.log('Grupo detectado por mensagem:',name);
  }
  if(!saved.groupId||chatId!==saved.groupId)return;
  const id=m.id?._serialized||m.id?.id;
  if(!id||messages.some(x=>x.id===id))return;
  const body=typeof m.body==='string'?m.body:'';
  // Respostas dos operadores não são pedidos novos.
  const result=outgoing?{order:false}:classify(body);
  const sender=outgoing?'Você':(m._data?.notifyName||m.author||'Participante');
  const senderPhone=outgoing?(phone||m.from||'').split('@')[0]:(m.author||m._data?.author||'').split('@')[0];
  const item={id,chatId,sender,phone:senderPhone,body,at:new Date((m.timestamp||Date.now()/1000)*1000).toISOString(),fromMe:outgoing,...result};
  messages=[...messages,item].slice(-300);
  if(result.order&&!saved.orders[id]){saved.orders[id]={status:'pending',...item};save();}
  console.log(outgoing?'Mensagem enviada no grupo:':'Mensagem recebida no grupo:',id);
  if(!outgoing){
   void Promise.resolve().then(()=>m.getContact()).then(contact=>{
    const name=contact?.pushname||contact?.name;
    const number=contact?.number||contact?.id?.user;
    if(name)item.sender=name;
    if(number)item.phone=String(number).split('@')[0];
    const order=saved.orders[id];if(order){if(name)order.sender=name;if(number)order.phone=item.phone;save();}
   }).catch(e=>console.warn('Contato indisponível:',String(e?.message||e)));
  }
 }catch(e){console.error('Erro ao processar mensagem:',e?.stack||e)}
}
client.on('message',captureMessage);
client.on('message_create',m=>{if(m.fromMe)captureMessage(m)});

client.initialize().catch(e=>{status='error';lastError=String(e)});
function reply(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${token}`)return reply(res,401,{error:'Unauthorized'});
 let data={};
 let route='unknown';
 try{
  if(req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Payload too large')}
   data=JSON.parse(raw||'{}');
  }
  route=new URL(req.url,'http://localhost').pathname;
  if(route==='/status')return reply(res,200,{status,qr,phone,lastError,groupId:saved.groupId,groups});
  if(route==='/groups'){if(status!=='ready')throw Error('WhatsApp desconectado');void refreshGroups();return reply(res,200,{groups,loading:!!groupsLoading,lastError});}
  if(route==='/select'){if(!groups.some(g=>g.id===data.groupId))throw Error('Grupo não encontrado');saved.groupId=data.groupId;messages=[];save();return reply(res,200,{ok:true});}
  if(route==='/messages')return reply(res,200,{messages,orders:Object.values(saved.orders).filter(o=>o.chatId===saved.groupId)});
  if(route==='/edit-order'){
   const order=saved.orders[data.id];
   if(!order||order.chatId!==saved.groupId||order.status!=='pending')throw Error('Pedido pendente não encontrado');
   if(order.priceRepliedAt)throw Error('Não é possível editar um preço já enviado');
   const edit=data.edit;
   if(!edit||!['dragao','pinguim'].includes(edit.group)||typeof edit.body!=='string'||edit.body.length>4000)throw Error('Dados de edição inválidos');
   if(!Array.isArray(edit.rows)||edit.rows.length!==4)throw Error('Informe as quatro faixas');
   const tiers=['10','11-15','15-18','19-25'];
   const rows=edit.rows.map((row,i)=>({tier:tiers[i],quantity:Number(row.quantity),unit:row.unit===''||row.unit===null?null:Number(row.unit)}));
   if(rows.some(x=>!Number.isSafeInteger(x.quantity)||x.quantity<0||x.quantity>100000||x.unit!==null&&(!Number.isFinite(x.unit)||x.unit<0||x.unit>10000)))throw Error('Quantidade ou preço inválido');
   if(!rows.some(x=>x.quantity>0))throw Error('Informe uma quantidade');
   order.edit={group:edit.group,body:edit.body,rows};order.body=edit.body;order.quantity=rows.reduce((n,x)=>n+x.quantity,0);save();
   return reply(res,200,{ok:true});
  }
  if(route==='/quote-price'){
   if(status!=='ready'||!saved.groupId)throw Error('WhatsApp não conectado');
   const order=saved.orders[data.id];
   if(!order||order.chatId!==saved.groupId||order.status!=='pending')throw Error('Pedido pendente não encontrado');
   if(order.priceRepliedAt)throw Error('Preço já respondido neste pedido');
   const calc=priceDetails(order,data.group);
   const quoted=await client.getMessageById(order.id);
   if(!quoted)throw Error('Mensagem original não encontrada para responder');
   await quoted.reply(makeComanda(calc.total),saved.groupId);
   order.priceRepliedAt=new Date().toISOString();order.priceDetails=calc;save();
   return reply(res,200,{ok:true,...calc});
  }
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
 }catch(e){console.error('WhatsApp API',route,String(e?.stack||e));return reply(res,400,{error:String(e.message||e)})}
});
server.listen(port,bind,()=>console.log(`PEAK WhatsApp ${operatorId} on ${bind}:${port}`));
process.on('SIGINT',()=>{server.close();client.destroy().finally(()=>process.exit(0))});
