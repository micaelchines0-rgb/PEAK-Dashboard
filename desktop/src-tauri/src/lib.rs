mod updates;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;
use std::sync::Mutex;
use std::process::{Child,Command,Stdio};
use std::io::Read;

const SUPABASE_URL: &str = "https://pnigecdjotqaxktnmnkj.supabase.co";
const SUPABASE_PUBLIC_KEY: &str = "sb_publishable_hvV4gGkZMfFCFD8ZrrTkAg_vPN1n31b";
static SESSION: Mutex<Option<LoginSession>> = Mutex::new(None);
#[derive(Clone,Serialize)]
struct LoginSession { user_id:String, name:String, role:String, access_token:String }
#[derive(Deserialize)]
struct AuthReply { access_token:Option<String>,user:Option<AuthUser>,error_description:Option<String>,msg:Option<String> }
#[derive(Deserialize)]
struct AuthUser { id:String }
#[derive(Deserialize)]
struct ProfileReply { display_name:String,role:String,active:bool }
#[derive(Serialize)]
struct SessionView { user_id:String,name:String,role:String }
fn authenticated()->Result<LoginSession,String>{
 let session=SESSION.lock().map_err(|_|"Erro de sessão".to_string())?.clone().ok_or_else(||"Faça login para acessar os serviços".to_string())?;
 // Fail closed: validate the token and active profile with Supabase for every protected operation.
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(8)).build().map_err(|_|"Não foi possível verificar a conexão".to_string())?;
 let auth=client.get(format!("{SUPABASE_URL}/auth/v1/user")).header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&session.access_token).send().map_err(|_|"Sem conexão com o servidor. Operação bloqueada.".to_string())?;
 if !auth.status().is_success(){return Err("Sessão expirada. Faça login novamente.".into())}
 let user:AuthUser=auth.json().map_err(|_|"Não foi possível validar sua sessão".to_string())?;
 if user.id!=session.user_id{return Err("Sessão inválida".into())}
 let response=client.get(format!("{SUPABASE_URL}/rest/v1/peak_profiles?user_id=eq.{}&select=display_name,role,active",session.user_id))
  .header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&session.access_token).send().map_err(|_|"Sem conexão com o servidor. Operação bloqueada.".to_string())?;
 if !response.status().is_success(){return Err("Não foi possível validar sua permissão".into())}
 let profiles:Vec<ProfileReply>=response.json().map_err(|_|"Resposta de permissão inválida".to_string())?;
 let profile=profiles.into_iter().next().ok_or("Operador não autorizado")?;
 if !profile.active{return Err("Seu acesso foi bloqueado pelo administrador".into())}
 if profile.role!=session.role{return Err("Suas permissões foram alteradas. Faça login novamente".into())}
 let access=client.post(format!("{SUPABASE_URL}/rest/v1/rpc/peak_operator_can_write"))
  .header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&session.access_token)
  .json(&serde_json::json!({"p_operator":session.user_id})).send()
  .map_err(|_|"Não foi possível consultar o fechamento financeiro".to_string())?;
 if !access.status().is_success(){return Err("Não foi possível validar o expediente".into())}
 let allowed:bool=access.json().map_err(|_|"Resposta financeira inválida".to_string())?;
 if !allowed{return Err("Comissão PEAK pendente. Aguarde a baixa do administrador para voltar a operar.".into())}
 Ok(session)
}
#[tauri::command]
fn operator_finance()->Result<serde_json::Value,String>{
 let session=SESSION.lock().map_err(|_|"Erro de sessão".to_string())?.clone().ok_or("Faça login")?;
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e|e.to_string())?;
 let response=client.post(format!("{SUPABASE_URL}/rest/v1/rpc/peak_my_finance"))
  .header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&session.access_token)
  .json(&serde_json::json!({})).send().map_err(|_|"Sem conexão para consultar comissão".to_string())?;
 if !response.status().is_success(){return Err("Não foi possível consultar a comissão".into())}
 response.json().map_err(|_|"Resposta financeira inválida".into())
}
#[tauri::command]
fn current_operator()->Option<SessionView>{SESSION.lock().ok()?.as_ref().map(|s|SessionView{user_id:s.user_id.clone(),name:s.name.clone(),role:s.role.clone()})}
#[tauri::command]
fn logout_operator()->Result<(),String>{*SESSION.lock().map_err(|_|"Erro de sessão".to_string())?=None;Ok(())}
#[tauri::command]
fn login_operator(username:String,password:String)->Result<SessionView,String>{
 if username.trim().is_empty()||password.is_empty(){return Err("Informe usuário e senha".into())}
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e|e.to_string())?;
 let response=client.post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=password"))
  .header("apikey",SUPABASE_PUBLIC_KEY).json(&serde_json::json!({"email":format!("{}@operators.peak.invalid",username.trim().to_lowercase()),"password":password})).send().map_err(|_|"Não foi possível conectar ao servidor".to_string())?;
 let ok=response.status().is_success();let body:AuthReply=response.json().map_err(|_|"Resposta de autenticação inválida".to_string())?;
 if !ok{return Err(body.error_description.or(body.msg).unwrap_or("Credenciais inválidas".into()))}
 let token=body.access_token.ok_or("Sessão não recebida")?;
 let user=body.user.ok_or("Usuário não identificado")?;
 let response=client.get(format!("{SUPABASE_URL}/rest/v1/peak_profiles?user_id=eq.{}&select=display_name,role,active",user.id))
  .header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&token).send().map_err(|_|"Não foi possível validar o operador".to_string())?;
 if !response.status().is_success(){return Err("Sem autorização para acessar o PEAK Dashboard".into())}
 let profiles:Vec<ProfileReply>=response.json().map_err(|_|"Perfil inválido".to_string())?;
 let profile=profiles.into_iter().next().ok_or("Seu usuário ainda não foi cadastrado pelo administrador")?;
 if !profile.active{return Err("Seu acesso está bloqueado. Fale com o administrador".into())}
 if profile.role!="admin"&&profile.role!="operator"{return Err("Perfil sem permissão".into())}
 let session=LoginSession{user_id:user.id,name:profile.display_name,role:profile.role,access_token:token};
 let view=SessionView{user_id:session.user_id.clone(),name:session.name.clone(),role:session.role.clone()};
 *SESSION.lock().map_err(|_|"Erro de sessão".to_string())?=Some(session);Ok(view)
}


#[derive(Serialize)]
struct Order { id:i64, created:String, client:String, phone:String, link:String, deposit:f64, withdrawal:f64, blogger:f64 }
#[derive(Deserialize)]
struct OrderInput { client:String, phone:String, link:String, deposit:f64, withdrawal:f64, blogger:f64 }
fn folder()->Result<PathBuf,String>{
 let base=dirs::data_dir().ok_or("Pasta de dados indisponível")?;
 let dir=base.join("PEAK_Dashboard");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;Ok(dir)
}
fn database()->Result<Connection,String>{
 let db=folder()?.join("peak.sqlite3");
 let c=Connection::open(db).map_err(|e|e.to_string())?;
 c.execute_batch("CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,created TEXT NOT NULL,client TEXT NOT NULL,phone TEXT,link TEXT,deposit REAL NOT NULL,withdrawal REAL NOT NULL,blogger REAL NOT NULL);CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT);").map_err(|e|e.to_string())?;
 let has_owner:bool=c.prepare("PRAGMA table_info(orders)").map_err(|e|e.to_string())?.query_map([],|r|r.get::<_,String>(1)).map_err(|e|e.to_string())?.filter_map(Result::ok).any(|n|n=="operator_id");
 if !has_owner {c.execute("ALTER TABLE orders ADD COLUMN operator_id TEXT",[]).map_err(|e|e.to_string())?;}
 Ok(c)
}
fn device_id(c:&Connection)->Result<String,String>{
 let existing:Result<String,_>=c.query_row("SELECT v FROM meta WHERE k='device_id'",[],|r|r.get(0));
 if let Ok(id)=existing{return Ok(id)}
 let id=uuid::Uuid::new_v4().to_string();
 c.execute("INSERT OR IGNORE INTO meta(k,v) VALUES('device_id',?)",params![id]).map_err(|e|e.to_string())?;
 c.query_row("SELECT v FROM meta WHERE k='device_id'",[],|r|r.get(0)).map_err(|e|e.to_string())
}
fn sync_operation(session:&LoginSession,device:&str,id:i64,action:&str,input:Option<&OrderInput>)->Result<(),String>{
 let mut body=serde_json::json!({"action":action,"device_id":device,"local_order_id":id});
 if let Some(x)=input{
  body["client"]=serde_json::json!(x.client.trim());
  body["phone"]=serde_json::json!(x.phone);
  body["link"]=serde_json::json!(x.link);
  body["deposit"]=serde_json::json!(x.deposit);
  body["withdrawal"]=serde_json::json!(x.withdrawal);
  body["blogger"]=serde_json::json!(x.blogger);
 }
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e|e.to_string())?;
 let response=client.post(format!("{SUPABASE_URL}/functions/v1/peak-desktop-operations"))
  .header("apikey",SUPABASE_PUBLIC_KEY).bearer_auth(&session.access_token).json(&body)
  .send().map_err(|_|"Sem internet: serviço não foi confirmado".to_string())?;
 if !response.status().is_success(){
  let value:serde_json::Value=response.json().unwrap_or_default();
  return Err(value.get("error").and_then(|v|v.as_str()).unwrap_or("Servidor recusou a operação").to_string())
 }
 Ok(())
}
fn read_orders(c:&Connection,session:&LoginSession)->Result<Vec<Order>,String>{
 let mut stmt=c.prepare("SELECT id,created,client,COALESCE(phone,''),COALESCE(link,''),deposit,withdrawal,blogger FROM orders WHERE operator_id=? OR (?=1 AND operator_id IS NULL) ORDER BY id DESC").map_err(|e|e.to_string())?;
 let iter=stmt.query_map(params![session.user_id,if session.role=="admin"{1}else{0}],|r|Ok(Order{id:r.get(0)?,created:r.get(1)?,client:r.get(2)?,phone:r.get(3)?,link:r.get(4)?,deposit:r.get(5)?,withdrawal:r.get(6)?,blogger:r.get(7)?})).map_err(|e|e.to_string())?;
 iter.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
fn validate(x:&OrderInput)->Result<(),String>{
 if x.client.trim().is_empty(){return Err("Informe o nome da cliente".into())}
 if [x.deposit,x.withdrawal,x.blogger].iter().any(|v|!v.is_finite()||*v<0.0){return Err("Valores devem ser positivos e válidos".into())}
 Ok(())
}
#[tauri::command]
fn list_orders()->Result<Vec<Order>,String>{let session=authenticated()?;read_orders(&database()?,&session)}
#[tauri::command]
fn save_order(input:OrderInput,id:Option<i64>)->Result<(),String>{
 let session=authenticated()?;validate(&input)?;let mut c=database()?;let device=device_id(&c)?;
 let tx=c.transaction().map_err(|e|e.to_string())?;
 let local_id=if let Some(id)=id{
  let owner:Result<String,_>=tx.query_row("SELECT operator_id FROM orders WHERE id=?",params![id],|r|r.get(0));
  if owner.ok().as_deref()!=Some(session.user_id.as_str()){return Err("Serviço não pertence ao operador".into())}
  tx.execute("UPDATE orders SET client=?,phone=?,link=?,deposit=?,withdrawal=?,blogger=? WHERE id=? AND operator_id=?",params![input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger,id,session.user_id]).map_err(|e|e.to_string())?;
  id
 }else{
  tx.execute("INSERT INTO orders(created,client,phone,link,deposit,withdrawal,blogger,operator_id) VALUES(?,?,?,?,?,?,?,?)",params![chrono::Local::now().to_rfc3339(),input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger,session.user_id]).map_err(|e|e.to_string())?;
  tx.last_insert_rowid()
 };
 sync_operation(&session,&device,local_id,"upsert",Some(&input))?;
 tx.commit().map_err(|e|e.to_string())?;
 Ok(())
}
#[tauri::command]
fn delete_order(id:i64)->Result<(),String>{
 let session=authenticated()?;let mut c=database()?;let device=device_id(&c)?;
 let tx=c.transaction().map_err(|e|e.to_string())?;
 let owner:Result<String,_>=tx.query_row("SELECT operator_id FROM orders WHERE id=?",params![id],|r|r.get(0));
 if owner.ok().as_deref()!=Some(session.user_id.as_str()){return Err("Serviço não pertence ao operador".into())}
 sync_operation(&session,&device,id,"delete",None)?;
 tx.execute("DELETE FROM orders WHERE id=? AND operator_id=?",params![id,session.user_id]).map_err(|e|e.to_string())?;
 tx.commit().map_err(|e|e.to_string())?;Ok(())
}
#[tauri::command]
fn get_notes()->Result<String,String>{
 authenticated()?;let c=database()?;let mut stmt=c.prepare("SELECT v FROM meta WHERE k='notes'").map_err(|e|e.to_string())?;
 let mut rows=stmt.query([]).map_err(|e|e.to_string())?;
 Ok(rows.next().map_err(|e|e.to_string())?.map(|r|r.get(0).unwrap_or_default()).unwrap_or_default())
}
#[tauri::command]
fn set_notes(text:String)->Result<(),String>{
 authenticated()?;database()?.execute("INSERT INTO meta(k,v) VALUES('notes',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",params![text]).map_err(|e|e.to_string())?;Ok(())
}
#[tauri::command]
fn open_data_folder()->Result<(),String>{authenticated()?;open::that(folder()?).map_err(|e|e.to_string())}
#[tauri::command]
fn export_closing()->Result<String,String>{
 let session=authenticated()?;let mut c=database()?;let rows=read_orders(&c,&session)?;
 if rows.is_empty(){return Err("Nenhuma operação para fechar".into())}
 let dir=folder()?.join("Fechamentos");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 let file=dir.join(format!("Fechamento_{}.csv",chrono::Local::now().format("%Y-%m-%d_%H-%M-%S")));
 let mut csv=String::from("\u{feff}Data;Nome da cliente;Telefone;Link;Depósito;Saque;Blogueira;Lucro líquido\r\n");
 for r in rows.iter().rev(){
  let q=|s:&str|format!("\"{}\"",s.replace('"',"\"\"").replace('\r'," ").replace('\n'," "));
  csv.push_str(&format!("{};{};{};{};{:.2};{:.2};{:.2};{:.2}\r\n",q(&r.created),q(&r.client),q(&r.phone),q(&r.link),r.deposit,r.withdrawal,r.blogger,r.withdrawal+r.blogger-r.deposit));
 }
 fs::write(&file,csv).map_err(|e|e.to_string())?;
 let tx=c.transaction().map_err(|e|e.to_string())?;
 tx.execute("DELETE FROM orders WHERE operator_id=? OR (?=1 AND operator_id IS NULL)",params![session.user_id,if session.role=="admin"{1}else{0}]).map_err(|e|e.to_string())?;
 tx.commit().map_err(|e|e.to_string())?;
 Ok(file.display().to_string())
}
#[tauri::command]
fn open_whatsapp_web()->Result<(),String>{authenticated()?;open::that("https://web.whatsapp.com/").map_err(|e|e.to_string())}
#[derive(Serialize,Deserialize,Clone)]
struct RemoteWhatsApp { host:String, port:u16, token:String }
fn remote_whatsapp_file()->Result<PathBuf,String>{Ok(folder()?.join("whatsapp-server.json"))}
fn remote_whatsapp()->Option<RemoteWhatsApp>{
 let raw=fs::read_to_string(remote_whatsapp_file().ok()?).ok()?;
 serde_json::from_str(&raw).ok()
}
#[tauri::command]
fn whatsapp_server_settings()->Result<serde_json::Value,String>{
 authenticated()?;
 if let Some(c)=remote_whatsapp(){Ok(serde_json::json!({"configured":true,"host":c.host,"port":c.port}))}
 else{Ok(serde_json::json!({"configured":false}))}
}
#[tauri::command]
fn whatsapp_configure_server(host:String,port:u16,token:String)->Result<(),String>{
 authenticated()?;
 if !host.starts_with("100.")||host.parse::<std::net::Ipv4Addr>().is_err(){return Err("Informe o IP 100.x.y.z do computador servidor no Tailscale".into())}
 if port<1024||token.trim().len()<32||token.trim().len()>256{return Err("Porta ou chave de conexão inválida".into())}
 let config=RemoteWhatsApp{host,port,token:token.trim().to_string()};
 let path=remote_whatsapp_file()?;
 fs::write(&path,serde_json::to_vec(&config).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
 Ok(())
}
#[tauri::command]
fn whatsapp_remove_server()->Result<(),String>{
 authenticated()?;
 let path=remote_whatsapp_file()?;
 if path.exists(){fs::remove_file(path).map_err(|e|e.to_string())?}
 Ok(())
}
#[tauri::command]
async fn whatsapp_bridge(route:String,payload:Option<serde_json::Value>)->Result<serde_json::Value,String>{
 tauri::async_runtime::spawn_blocking(move || whatsapp_bridge_blocking(route,payload))
  .await.map_err(|_|"Falha ao consultar servidor WhatsApp".to_string())?
}
fn whatsapp_bridge_blocking(route:String,payload:Option<serde_json::Value>)->Result<serde_json::Value,String>{
 authenticated()?;
 let allowed=["status","groups","select","messages","send","order","quote-price","edit-order","confirm-payment","complete-order"];
 if !allowed.contains(&route.as_str()){return Err("Ação inválida".into())}
 let remote=remote_whatsapp();
 let (url,token)=if let Some(c)=remote{
  (format!("http://{}:{}/{}",c.host,c.port,route),c.token)
 }else{
  let home=dirs::home_dir().ok_or("Pasta do usuário indisponível")?;
  let token=fs::read_to_string(home.join(".peak-whatsapp-bridge").join("local").join("token"))
   .map_err(|_|"Conector local não iniciado. Configure o servidor PEAK.".to_string())?;
  (format!("http://127.0.0.1:38741/{}",route),token)
 };
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(15))
  .build().map_err(|e|e.to_string())?;
 let request=if let Some(body)=payload{client.post(&url).json(&body)}else{client.get(&url)};
 let response=request.bearer_auth(token.trim()).send().map_err(|_|"Conector WhatsApp offline. Inicie o serviço local.".to_string())?;
 let status=response.status();
 let value:serde_json::Value=response.json().map_err(|e|e.to_string())?;
 if !status.is_success(){return Err(value.get("error").and_then(|x|x.as_str()).unwrap_or("Erro no conector").to_string())}
 Ok(value)
}
struct WhatsAppProcess(Mutex<Option<Child>>);
fn bridge_root(app:&tauri::AppHandle)->Result<PathBuf,String>{
 let resource=app.path().resource_dir().map_err(|e|e.to_string())?;
 // Windows Tauri paths can use the extended-length prefix \\?\\.
 // Node's main-module resolver does not reliably accept that prefix.
 #[cfg(windows)]
 let resource={
  let raw=resource.to_string_lossy();
  match raw.strip_prefix(r"\\?\") {
   Some(stripped)=>PathBuf::from(stripped),
   None=>resource,
  }
 };
 Ok(resource.join("whatsapp-bridge"))
}
fn start_whatsapp_service(app:&tauri::AppHandle)->Result<Child,String>{
 let root=bridge_root(app)?;
 let runtime=root.join("node.exe");
 let entry=root.join("server.mjs");
 if !runtime.is_file()||!entry.is_file(){return Err(format!("Conector não encontrado em {}",root.display()))}
 let logdir=app.path().app_log_dir().map_err(|e|e.to_string())?;
 fs::create_dir_all(&logdir).map_err(|e|e.to_string())?;
 let logfile=fs::OpenOptions::new().create(true).append(true).open(logdir.join("whatsapp-bridge.log")).map_err(|e|e.to_string())?;
 let errfile=logfile.try_clone().map_err(|e|e.to_string())?;
 Command::new(runtime).arg(entry).current_dir(&root)
  .env("PUPPETEER_CACHE_DIR",root.join("puppeteer-cache"))
  .env("PEAK_WHATSAPP_LOG_DIR",&logdir)
  .stdin(Stdio::null()).stdout(Stdio::from(logfile)).stderr(Stdio::from(errfile))
  .spawn().map_err(|e|format!("Não foi possível iniciar o WhatsApp: {e}"))
}
#[tauri::command]
fn whatsapp_diagnostics(app:tauri::AppHandle)->Result<String,String>{
 authenticated()?;
 let root=bridge_root(&app)?;
 let log=app.path().app_log_dir().map_err(|e|e.to_string())?.join("whatsapp-bridge.log");
 let mut detail=format!("Pasta do conector: {}\\nnode.exe: {}\\nserver.mjs: {}\\n",root.display(),root.join("node.exe").exists(),root.join("server.mjs").exists());
 if let Ok(mut file)=fs::File::open(&log){let mut data=String::new();let _=file.read_to_string(&mut data);let start=data.char_indices().map(|(i,_)|i).filter(|i|*i<=data.len().saturating_sub(5000)).last().unwrap_or(0);detail.push_str(&format!("Log: {}\\n{}",log.display(),&data[start..]));}
 else{detail.push_str(&format!("Log não encontrado: {}",log.display()));}
 Ok(detail)
}
#[tauri::command]
fn whatsapp_restart(_app:tauri::AppHandle,state:tauri::State<WhatsAppProcess>)->Result<(),String>{
 authenticated()?;
 let mut guard=state.0.lock().map_err(|_|"Falha ao acessar processo".to_string())?;
 if let Some(mut child)=guard.take(){let _=child.kill();let _=child.wait();}
 return Err("Esta versão cliente usa o servidor PEAK remoto. Configure o servidor nas opções do WhatsApp.".into());
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
 tauri::Builder::default()
 .manage(WhatsAppProcess(Mutex::new(None)))
 .on_window_event(|window,event|{
  if let tauri::WindowEvent::Destroyed=event{
   if window.app_handle().webview_windows().len()<=1{
    if let Ok(mut guard)=window.state::<WhatsAppProcess>().0.lock(){if let Some(mut child)=guard.take(){let _=child.kill();let _=child.wait();}}
   }
  }
 })
 .invoke_handler(tauri::generate_handler![operator_finance,login_operator,logout_operator,current_operator,list_orders,save_order,delete_order,get_notes,set_notes,open_data_folder,export_closing,updates::check_for_updates,updates::download_and_install_update,open_whatsapp_web,whatsapp_bridge,whatsapp_diagnostics,whatsapp_restart,whatsapp_server_settings,whatsapp_configure_server,whatsapp_remove_server])
 .run(tauri::generate_context!()).expect("Erro ao iniciar PEAK Dashboard");
}
