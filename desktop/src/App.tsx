import {useEffect,useMemo,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Activity,ArrowDownToLine,ArrowUpFromLine,Check,ClipboardCopy,Database,Download,FileSpreadsheet,Menu,Plus,RefreshCw,Save,Search,Settings2,Shuffle,Trash2,Wallet,X} from 'lucide-react';

type UpdateInfo={available:boolean;current_version:string;latest_version:string;release_url:string};
type Order={id:number;created:string;client:string;phone:string;link:string;deposit:number;withdrawal:number;blogger:number};
type Input={client:string;phone:string;link:string;deposit:number;withdrawal:number;blogger:number};
const blank:Input={client:'',phone:'',link:'',deposit:0,withdrawal:0,blogger:0};
const currency=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const number=(v:string)=>Number(v.replace(/\./g,'').replace(',','.'))||0;
const cmd=<T,>(name:string,args?:Record<string,unknown>)=>invoke<T>(name,args);
type DashboardSettings={theme:'black'|'light';accent:string;dragonName:string;penguinName:string;rates:Record<string,number>;dragonSiglas:string;penguinSiglas:string;pixKey:string;pixHolder:string;pixMessage:string};
const defaultSettings:DashboardSettings={theme:'black',accent:'#8558f3',dragonName:'Dragão',penguinName:'Pinguim',rates:{D5:5,D7:7,D9:9,D11:11,P6:6,P8:8},dragonSiglas:'XW, 888, DY, WE, DZ, OKOK, ANJO, AJ, ANJO/AJ, 777, A8, VOY, W1, 91, EK, WP, M9, RF',penguinSiglas:'MANGA, T1, BOI, MK, Y8, AM, AE, BRA, AA, SQ, M8, GAME, SE, 555',pixKey:'81995882238',pixHolder:'MICAEL RICARDO',pixMessage:'MARCAR E ENVIAR O COMPROVANTE'};
const loadSettings=():DashboardSettings=>{try{const raw=localStorage.getItem('peak-v11-settings');if(!raw)return defaultSettings;const parsed=JSON.parse(raw);return {...defaultSettings,...parsed,rates:{...defaultSettings.rates,...parsed.rates}}}catch{return defaultSettings}};
type Finance={shift_open:boolean;can_operate:boolean;current_blogger:number;current_company:number;pending_due:number};
type OperatorSession={user_id:string;name:string;role:'admin'|'operator'};
function App(){
 const [operator,setOperator]=useState<OperatorSession|null>(null);
 const [finance,setFinance]=useState<Finance|null>(null);
 const [financeError,setFinanceError]=useState('');
 const refreshFinance=async()=>{try{setFinance(await cmd<Finance>('operator_finance'));setFinanceError('')}catch(e){setFinanceError(String(e));setFinance(null)}};
 const [loginUsername,setLoginEmail]=useState('');
 const [loginPassword,setLoginPassword]=useState('');
 const [loginBusy,setLoginBusy]=useState(false);
 const [loginError,setLoginError]=useState('');
 const doLogin=async(e:React.FormEvent)=>{e.preventDefault();setLoginBusy(true);setLoginError('');try{const user=await cmd<OperatorSession>('login_operator',{username:loginUsername,password:loginPassword});setOperator(user);setLoginPassword('');}catch(error){setLoginError(String(error))}finally{setLoginBusy(false)}};
 const doLogout=async()=>{await cmd('logout_operator');setOperator(null);setFinance(null);setOrders([]);setNotes('');setForm(blank);setSelected(null)};

 const[orders,setOrders]=useState<Order[]>([]),[form,setForm]=useState<Input>(blank),[selected,setSelected]=useState<number|null>(null);
 const[notes,setNotes]=useState(''),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[generator,setGenerator]=useState(false);
 const[genMin,setGenMin]=useState(11),[genMax,setGenMax]=useState(15),[genCount,setGenCount]=useState(10),[generated,setGenerated]=useState<number[]>([]);
 const[prices,setPrices]=useState<Record<string,number>>({}),[sigla,setSigla]=useState(''),[calc,setCalc]=useState<string[][]>([['',''],['','']]);
 const calcRefs=useRef<Record<string,HTMLInputElement|null>>({});
 const pendingCalcFocus=useRef<string|null>(null);
 const updateCalc=(column:number,index:number,value:string)=>{
  setCalc(previous=>previous.map((rows,c)=>{
   if(c!==column)return rows;
   const next=[...rows];next[index]=value;
   // Remove blank extra rows when their values are erased, keeping two baseline fields.
   if(index>=2&&value.trim()===''){
    next.splice(index,1);
    pendingCalcFocus.current=c+':'+(index-1);
   }
   return next;
  }));
 };
 const nextCalc=(column:number,index:number)=>{
  const target=index+1;
  pendingCalcFocus.current=column+':'+target;
  setCalc(previous=>previous.map((rows,c)=>{
   if(c!==column)return rows;
   return target>=rows.length?[...rows,'']:rows;
  }));
  // If the next field already exists, focus it without waiting for a state update.
  requestAnimationFrame(()=>{const key=pendingCalcFocus.current;if(key){const el=calcRefs.current[key];if(el){el.focus();el.parentElement?.scrollTo({top:el.offsetTop,behavior:'smooth'});pendingCalcFocus.current=null}}});
 };
 useEffect(()=>{
  const key=pendingCalcFocus.current;
  if(!key)return;
  const el=calcRefs.current[key];
  if(el){el.focus();el.scrollIntoView({block:'nearest'});pendingCalcFocus.current=null}
 },[calc]);
 const[updateInfo,setUpdateInfo]=useState<UpdateInfo|null>(null);
 const[updateBusy,setUpdateBusy]=useState(false);
 const[updateError,setUpdateError]=useState('');
 const[showUpdate,setShowUpdate]=useState(false);
 const checkUpdates=async(manual=false)=>{
  try{
   if(manual)setUpdateBusy(true);
   setUpdateError('');
   const result=await cmd<UpdateInfo>('check_for_updates');
   setUpdateInfo(result);
   if(result.available||manual)setShowUpdate(true);
  }catch(e){if(manual){setUpdateError(String(e));setShowUpdate(true)}}
  finally{if(manual)setUpdateBusy(false)}
 };
 const installUpdate=async()=>{
  setUpdateBusy(true);setUpdateError('');
  try{await cmd('download_and_install_update');setUpdateError('Instalador aberto. Confirme a instalação no Windows e feche a PEAK Dashboard quando solicitado.');}
  catch(e){setUpdateError(String(e))}
  finally{setUpdateBusy(false)}
 };
 useEffect(()=>{const timer=setTimeout(()=>{void checkUpdates(false)},1800);return()=>clearTimeout(timer)},[]);
 const[settings,setSettings]=useState<DashboardSettings>(loadSettings);
 const[settingsOpen,setSettingsOpen]=useState(false);
 useEffect(()=>{try{localStorage.setItem('peak-v11-settings',JSON.stringify(settings))}catch{}},[settings]);
 const changeSetting=<K extends keyof DashboardSettings>(key:K,value:DashboardSettings[K])=>setSettings(previous=>({...previous,[key]:value}));
 const[sidebar,setSidebar]=useState(true);
 const[splitWidth,setSplitWidth]=useState(0);
 const splitRef=useRef<HTMLDivElement>(null);
 const dragging=useRef(false);
 const startSplit=(e:React.PointerEvent<HTMLDivElement>)=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId)};
 const moveSplit=(e:React.PointerEvent<HTMLDivElement>)=>{if(!dragging.current||!splitRef.current)return;const rect=splitRef.current.getBoundingClientRect();setSplitWidth(Math.max(280,Math.min(rect.width-580,e.clientX-rect.left-9)))};
 const stopSplit=()=>{dragging.current=false};
 const resetSplit=()=>setSplitWidth(0);
 const refresh=async()=>{try{setOrders(await cmd<Order[]>('list_orders'))}catch(e){setMessage(String(e))}};
 useEffect(()=>{if(!operator)return;void refreshFinance();const timer=setInterval(()=>void refreshFinance(),30000);return()=>clearInterval(timer)},[operator]);
 useEffect(()=>{if(operator){void refresh();cmd<string>('get_notes').then(setNotes).catch(e=>setMessage(String(e))) }},[operator]);
 useEffect(()=>{if(!operator)return;const timer=setTimeout(()=>cmd('set_notes',{text:notes}).catch(e=>setMessage(String(e))),700);return()=>clearTimeout(timer)},[notes,operator]);
 const totals=useMemo(()=>orders.reduce((a,o)=>({deposit:a.deposit+o.deposit,withdrawal:a.withdrawal+o.withdrawal,blogger:a.blogger+o.blogger}),{deposit:0,withdrawal:0,blogger:0}),[orders]);
 const profit=totals.withdrawal+totals.blogger-totals.deposit;
 const filtered=orders.filter(o=>[o.client,o.phone,o.link].some(s=>s.toLowerCase().includes(search.toLowerCase())));
 const normalizeSigla=(value:string)=>value.trim().toUpperCase().replace(/^(GRUPO|CLUBE)\s+/,'').replace(/\s+/g,'');
 const dragonSiglas=new Set(settings.dragonSiglas.split(/[,;\n]+/).map(normalizeSigla).filter(Boolean));
 const penguinSiglas=new Set(settings.penguinSiglas.split(/[,;\n]+/).map(normalizeSigla).filter(Boolean));
 const matchedSigla=normalizeSigla(sigla);
 const activeGroup=dragonSiglas.has(matchedSigla)?'D':penguinSiglas.has(matchedSigla)?'P':null;
 const updateSigla=(value:string)=>{const normalized=normalizeSigla(value);const group=dragonSiglas.has(normalized)?'D':penguinSiglas.has(normalized)?'P':null;setSigla(value);if(group)setPrices(previous=>Object.fromEntries(Object.entries(previous).map(([key,count])=>[key,key.startsWith(group)?count:0])))};
 const priceTotal=Object.entries(prices).reduce((a,[k,v])=>a+(settings.rates[k]??Number(k.slice(1)))*(v||0),0);
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await cmd('save_order',{input:form,id:selected});setForm(blank);setSelected(null);await refresh();await refreshFinance();setMessage('Operação salva com sucesso')}catch(e){setMessage(String(e))}};
 const edit=(o:Order)=>{setSelected(o.id);setForm({client:o.client,phone:o.phone,link:o.link,deposit:o.deposit,withdrawal:o.withdrawal,blogger:o.blogger});window.scrollTo({top:0,behavior:'smooth'})};
 const remove=async(id:number)=>{if(!confirm('Excluir esta operação?'))return;try{await cmd('delete_order',{id});await refresh();await refreshFinance()}catch(e){setMessage(String(e))}};
 const closing=async()=>{if(!confirm('Exportar fechamento e limpar operações após salvar?'))return;try{const file=await cmd<string>('export_closing');await refresh();setMessage('Fechamento salvo: '+file)}catch(e){setMessage(String(e))}};
 const copyPix=async()=>{const text=`📌 PIX CELULAR\n💠 ${settings.pixKey}\n🏷️ ${settings.pixHolder}\n\n💸 ${currency(priceTotal)}\n⚠️ ${settings.pixMessage}\n\n⏱️ Prazo para conclusão: de 30 min a 1h após o envio do comprovante.`;try{await navigator.clipboard.writeText(text);setMessage('Comanda copiada')}catch{setMessage('Não foi possível copiar')}};
 const make=()=>{if(genCount<1||genCount>500||genMin<0||genMax<genMin){setMessage('Confira os valores do gerador');return}setGenerated(Array.from({length:genCount},()=>Math.floor(Math.random()*(genMax-genMin+1))+genMin))};
 if(!operator)return <div className={"shell theme-"+settings.theme} style={{'--user-accent':settings.accent,minHeight:'100vh',display:'grid',placeItems:'center'} as React.CSSProperties}>
 <section className="card section" style={{width:'min(420px,calc(100vw - 32px))',padding:30}}>
  <div className="brand" style={{marginBottom:26}}><span className="brand-mark">▲</span><div><strong>PEAK</strong><small>DASHBOARD · ACESSO DO OPERADOR</small></div></div>
  <div className="eyebrow">IDENTIFICAÇÃO OBRIGATÓRIA</div><h2 style={{margin:'10px 0 6px'}}>Entrar na operação</h2>
  <p style={{opacity:.7,marginBottom:22}}>Entre com seu usuário autorizado para registrar serviços.</p>
  <form onSubmit={doLogin} className="form-grid" style={{display:'grid',gridTemplateColumns:'1fr'}}>
   <label>Usuário<input type="text" autoComplete="username" required value={loginUsername} onChange={e=>setLoginEmail(e.target.value)} placeholder="Digite seu usuário"/></label>
   <label>Senha<input type="password" autoComplete="current-password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Sua senha"/></label>
   {loginError&&<p role="alert" style={{color:'#ff7777',overflowWrap:'anywhere'}}>{loginError}</p>}
   <button className="btn primary submit" type="submit" disabled={loginBusy}>{loginBusy?'Validando acesso...':'Entrar na PEAK Dashboard'}</button>
  </form><small style={{opacity:.7}}>Sem cadastro? Solicite seu acesso ao administrador. O registro de serviços permanece bloqueado sem login.</small>
 </section></div>;
 return <div className={"shell theme-"+settings.theme} style={{'--user-accent':settings.accent} as React.CSSProperties}>
 <aside className={sidebar?'sidebar':'sidebar collapsed'}>
  <div className="brand"><span className="brand-mark">▲</span><div><strong>PEAK</strong><small>DASHBOARD</small></div></div>
  <div className="nav-title">MENU PRINCIPAL</div>
  <button className="nav active"><Activity size={18}/> Visão geral</button>
  <button className="nav" onClick={()=>setGenerator(true)}><Shuffle size={18}/> Gerador de depósitos</button>
  <button className="nav" onClick={()=>cmd('open_data_folder').catch(e=>setMessage(String(e)))}><Database size={18}/> Arquivos e dados</button>
  <button className="nav" onClick={()=>setSettingsOpen(true)}><Settings2 size={18}/> Configurações</button>\n  <div className="sidebar-bottom"><span className="status-dot"/> Banco de dados local <small>Versão 11.0.1</small></div>
 </aside>
 <main className="main">
  <header className="topbar"><button className="icon-btn" title="Menu" onClick={()=>setSidebar(!sidebar)}><Menu size={19}/></button><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>Visão geral <span className="title-dot">.</span></h1></div><div className="top-actions"><button className="btn ghost" onClick={()=>void doLogout()} title="Encerrar sessão">Sair · {operator.name}</button><span className="online"><span className="status-dot"/> Sistema local</span><button className="btn ghost" onClick={refresh}><RefreshCw size={16}/> Atualizar dados</button><button className="btn ghost" onClick={()=>checkUpdates(true)}><Download size={16}/> Verificar versão</button><button className="btn primary" onClick={closing}><FileSpreadsheet size={16}/> Exportar fechamento local</button></div></header>
  <div style={{display:'flex',justifyContent:'flex-end',padding:'8px 18px 0'}}>
   <div title={financeError||((finance?.pending_due??0)>0?'Comissão pendente de pagamento':'Comissão PEAK acumulada no expediente')} style={{minWidth:152,maxWidth:220,padding:'9px 13px',border:'1px solid #2b3b58',borderLeft:'3px solid '+(finance&&!finance.can_operate?'#ff7474':'#4285ff'),borderRadius:10,background:'#151622',boxShadow:'0 3px 12px #0002'}}>
    <div style={{fontSize:10,letterSpacing:'.08em',fontWeight:700,opacity:.75}}>COMISSÃO PEAK</div>
    <strong style={{fontSize:17,lineHeight:1.5,color:finance&&!finance.can_operate?'#ff9292':'#f3f5ff'}}>{finance?currency((finance.pending_due??0)>0?finance.pending_due:finance.current_company):'—'}</strong>
   </div>
  </div>
  <div className="columns" ref={splitRef} style={splitWidth?{gridTemplateColumns:"minmax(280px, "+splitWidth+"px) 12px minmax(420px, 1fr)"}:undefined}>
   <div className="left-col">
    <section className="card section notes-card"><div className="section-head"><div><span className="eyebrow">ANOTAÇÕES</span><h3>Bloco de notas</h3></div><button className="text-btn" onClick={()=>setNotes('')}>Limpar</button></div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Suas anotações ficam salvas automaticamente..."/><small>↘ Arraste o canto inferior direito para redimensionar</small></section>
    <section className="card section"><div className="section-head"><div><span className="eyebrow">FERRAMENTAS</span><h3>Calculadora rápida</h3></div><button type="button" className="text-btn" onClick={()=>{pendingCalcFocus.current=null;setCalc([['',''],['','']]);Object.values(calcRefs.current).forEach(input=>input?.blur())}}>Limpar</button></div><div className="calc-grid">{['Depósitos','Saques'].map((label,column)=><div className="calc-column" key={label}><label>{label}</label><div className="calc-scroll">{calc[column].map((value,index)=><input key={column+':'+index} ref={element=>{calcRefs.current[column+':'+index]=element}} placeholder="0,00" inputMode="decimal" value={value} onChange={e=>updateCalc(column,index,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();nextCalc(column,index)}}}/>)}</div><strong>{currency(calc[column].reduce((sum,value)=>sum+number(value),0))}</strong></div>)}</div></section>
    <section className="card section"><div className="section-head"><div><span className="eyebrow">REGISTRO</span><h3>{selected?'Editar operação':'Nova operação'}</h3></div><span className="head-icon"><Plus size={19}/></span></div>
     <form onSubmit={save} className="form-grid">
      <label>Depósito (saída)<input type="number" step="0.01" min="0" value={form.deposit||''} onChange={e=>setForm({...form,deposit:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Saque (entrada)<input type="number" step="0.01" min="0" value={form.withdrawal||''} onChange={e=>setForm({...form,withdrawal:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Blogueira (valor pago)<input type="number" step="0.01" min="0" value={form.blogger||''} onChange={e=>setForm({...form,blogger:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Nome da cliente<input required value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="Nome completo"/></label>
      <label>Telefone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(81) 99999-9999"/></label>
      <label>Link da conta<input value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="https://..."/></label>
      <button className="btn primary submit" type="submit"><Save size={17}/>{selected?'Salvar alterações':'Salvar operação'}</button>
      {selected&&<button className="btn ghost submit" type="button" onClick={()=>{setSelected(null);setForm(blank)}}><X size={16}/> Cancelar edição</button>}
     </form><div className="operation-net" aria-live="polite"><span>Lucro líquido estimado</span><strong className={form.withdrawal+form.blogger-form.deposit<0?'net-negative':'net-positive'}>{currency(form.withdrawal+form.blogger-form.deposit)}</strong></div></section>
   </div>
   <div className="column-resizer" role="separator" title="Arraste para ajustar a largura. Clique duas vezes para restaurar." onPointerDown={startSplit} onPointerMove={moveSplit} onPointerUp={stopSplit} onLostPointerCapture={stopSplit} onDoubleClick={resetSplit}><span/></div>
   <div className="right-col">
  <section className="card section commands-top"><div className="section-head"><div><span className="eyebrow">COMANDAS</span><h3>{settings.dragonName} & {settings.penguinName}</h3></div></div>
   <div className="commands-layout">
    <div className="price-group"><h4 className="green">🐉 {settings.dragonName}</h4><div className="price-inputs">{['D5','D7','D9','D11'].map(t=><label key={t}>{t}<input type="number" min="0" value={prices[t]||''} disabled={activeGroup!==null&&activeGroup!==t.charAt(0)} onChange={e=>setPrices(p=>({...p,[t]:Number(e.target.value)}))} placeholder="0"/></label>)}</div></div>
    <div className="commands-center"><input aria-label="Consultar sigla" value={sigla} onChange={e=>updateSigla(e.target.value)} placeholder="CONSULTAR SIGLA (EX: 777)"/><span>Soma Total</span><div className="commands-center-bottom"><strong>{currency(priceTotal)}</strong><button className="btn primary copy-compact" title="Copiar PIX" aria-label="Copiar PIX" onClick={copyPix}><ClipboardCopy size={17}/></button></div></div>
    <div className="price-group"><h4 className="blue">🐧 {settings.penguinName}</h4><div className="price-inputs">{['P6','P8'].map(t=><label key={t}>{t}<input type="number" min="0" value={prices[t]||''} disabled={activeGroup!==null&&activeGroup!==t.charAt(0)} onChange={e=>setPrices(p=>({...p,[t]:Number(e.target.value)}))} placeholder="0"/></label>)}</div></div>
   </div>
  </section>

  <section className="metrics metrics-in-column" aria-label="Resumo financeiro">
   {([{title:'Depósitos',value:totals.deposit,color:'blue'},{title:'Saques',value:totals.withdrawal,color:'amber'},{title:'Blogueiras',value:totals.blogger,color:'purple'},{title:'Lucro líquido',value:profit,color:profit<0?'red':'green'}] as const).map(x=><div className={'metric metric-mini '+x.color} key={x.title}><div className="metric-top"><span className="metric-dot"/><span>{x.title}</span></div><strong>{currency(x.value)}</strong></div>)}
  </section>
    <section className="card section records"><div className="section-head"><div><span className="eyebrow">HISTÓRICO</span><h3>Pedidos registrados <span className="count">{orders.length}</span></h3></div><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..."/></div></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Link</th><th>Depósito</th><th>Saque</th><th>Blogueira</th><th>Lucro</th><th></th></tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td><strong>{o.client}</strong><small>{o.phone}</small></td><td className="link-cell">{o.link}</td><td>{currency(o.deposit)}</td><td>{currency(o.withdrawal)}</td><td>{currency(o.blogger)}</td><td className={o.withdrawal+o.blogger-o.deposit>=0?'green':'red'}>{currency(o.withdrawal+o.blogger-o.deposit)}</td><td><div className="row-actions"><button title="Editar" onClick={()=>edit(o)}><Settings2 size={15}/></button><button title="Excluir" onClick={()=>remove(o.id)}><Trash2 size={15}/></button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="empty">Nenhuma operação encontrada.</td></tr>}</tbody></table></div></section>
   </div>
  </div>
  {message&&<div className="toast" role="status"><span>{message}</span><button onClick={()=>setMessage('')}><X size={15}/></button></div>}
  {showUpdate&&<div className="overlay" onClick={()=>!updateBusy&&setShowUpdate(false)}><div className="modal card update-modal" role="dialog" aria-modal="true" aria-label="Atualização da PEAK Dashboard" onClick={e=>e.stopPropagation()}>
   <div className="section-head"><div><span className="eyebrow">ATUALIZAÇÕES</span><h3>PEAK Dashboard</h3></div><button className="icon-btn" disabled={updateBusy} onClick={()=>setShowUpdate(false)} aria-label="Fechar"><X size={18}/></button></div>
   {updateInfo?.available?<><p>Nova versão disponível: <strong>V{updateInfo.latest_version}</strong></p><p>Versão instalada: V{updateInfo.current_version}. O instalador oficial será baixado e verificado antes de abrir.</p></>:<p>{updateInfo?'Você já está usando a versão mais recente disponível.':'Não foi possível verificar a versão.'}</p>}
   {updateError&&<p className="update-status" role="status">{updateError}</p>}
   <div className="update-actions"><button className="btn ghost" disabled={updateBusy} onClick={()=>setShowUpdate(false)}>Agora não</button>{updateInfo?.available&&<button className="btn primary" disabled={updateBusy} onClick={installUpdate}><Download size={16}/>{updateBusy?'Baixando e verificando...':'Atualizar agora'}</button>}</div>
  </div></div>}
  {settingsOpen&&<div className="overlay" onClick={()=>setSettingsOpen(false)}><div className="modal card settings-modal" role="dialog" aria-modal="true" aria-label="Configurações da dashboard" onClick={e=>e.stopPropagation()}>
    <div className="section-head"><div><span className="eyebrow">PERSONALIZAÇÃO</span><h3>Configurações</h3></div><button className="icon-btn" onClick={()=>setSettingsOpen(false)} aria-label="Fechar"><X size={18}/></button></div>
    <div className="settings-body">
      <h4>Aparência</h4><div className="settings-themes"><button className={settings.theme==='black'?'theme-choice selected':'theme-choice'} onClick={()=>changeSetting('theme','black')}>◼ Tema Black</button><button className={settings.theme==='light'?'theme-choice selected':'theme-choice'} onClick={()=>changeSetting('theme','light')}>☀ Tema Claro</button></div>
      <label>Cor de destaque <input type="color" value={settings.accent} onChange={e=>changeSetting('accent',e.target.value)}/></label>
      <h4>Comanda</h4><div className="settings-two"><label>Nome Dragão<input value={settings.dragonName} onChange={e=>changeSetting('dragonName',e.target.value)}/></label><label>Nome Pinguim<input value={settings.penguinName} onChange={e=>changeSetting('penguinName',e.target.value)}/></label></div>
      <div className="settings-rates">{['D5','D7','D9','D11','P6','P8'].map(key=><label key={key}>Valor {key}<input type="number" min="0" step="0.01" value={settings.rates[key]??0} onChange={e=>changeSetting('rates',{...settings.rates,[key]:Math.max(0,Number(e.target.value)||0)})}/></label>)}</div>
      <label>Siglas do Dragão (separadas por vírgula)<textarea rows={2} value={settings.dragonSiglas} onChange={e=>changeSetting('dragonSiglas',e.target.value)}/></label>
      <label>Siglas do Pinguim (separadas por vírgula)<textarea rows={2} value={settings.penguinSiglas} onChange={e=>changeSetting('penguinSiglas',e.target.value)}/></label>
      <h4>Comanda PIX</h4><div className="settings-two"><label>Chave PIX<input value={settings.pixKey} onChange={e=>changeSetting('pixKey',e.target.value)}/></label><label>Nome do recebedor<input value={settings.pixHolder} onChange={e=>changeSetting('pixHolder',e.target.value)}/></label></div>
      <label>Mensagem do comprovante<input value={settings.pixMessage} onChange={e=>changeSetting('pixMessage',e.target.value)}/></label>
    </div>
    <div className="settings-actions"><button className="btn ghost" onClick={()=>setSettings(defaultSettings)}>Restaurar padrões</button><button className="btn primary" onClick={()=>setSettingsOpen(false)}><Check size={16}/> Concluir</button></div>
  </div></div>}
  {generator&&<div className="overlay" onClick={()=>setGenerator(false)}><div className="modal card" onClick={e=>e.stopPropagation()}><div className="section-head"><div><span className="eyebrow">FERRAMENTAS</span><h3>Gerador de depósitos</h3></div><button className="icon-btn" onClick={()=>setGenerator(false)}><X size={18}/></button></div><div className="gen-grid"><label>Mínimo<input type="number" value={genMin} onChange={e=>setGenMin(+e.target.value)}/></label><label>Máximo<input type="number" value={genMax} onChange={e=>setGenMax(+e.target.value)}/></label><label>Quantidade<input type="number" value={genCount} onChange={e=>setGenCount(+e.target.value)}/></label></div><button className="btn primary" onClick={make}><Shuffle size={16}/> Gerar valores</button><textarea readOnly value={generated.join('\n')} placeholder="Os depósitos aparecerão aqui..."/><div className="modal-footer"><strong>{generated.length} depósitos · {currency(generated.reduce((a,b)=>a+b,0))}</strong><button className="btn secondary" onClick={()=>navigator.clipboard.writeText(generated.join('\n')).then(()=>setMessage('Lista copiada')).catch(()=>setMessage('Não foi possível copiar'))}><ClipboardCopy size={16}/> Copiar</button></div></div></div>}
 </main></div>
}
export default App;