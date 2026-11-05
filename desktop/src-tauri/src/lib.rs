mod updates;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;
use std::sync::Mutex;

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
fn authenticated()->Result<LoginSession,String>{SESSION.lock().map_err(|_|"Erro de sessão".to_string())?.clone().ok_or_else(||"Faça login para acessar os serviços".into())}
#[tauri::command]
fn current_operator()->Option<SessionView>{SESSION.lock().ok()?.as_ref().map(|s|SessionView{user_id:s.user_id.clone(),name:s.name.clone(),role:s.role.clone()})}
#[tauri::command]
fn logout_operator()->Result<(),String>{*SESSION.lock().map_err(|_|"Erro de sessão".to_string())?=None;Ok(())}
#[tauri::command]
fn login_operator(email:String,password:String)->Result<SessionView,String>{
 if email.trim().is_empty()||password.is_empty(){return Err("Informe e-mail e senha".into())}
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e|e.to_string())?;
 let response=client.post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=password"))
  .header("apikey",SUPABASE_PUBLIC_KEY).json(&serde_json::json!({"email":email.trim(),"password":password})).send().map_err(|_|"Não foi possível conectar ao servidor".to_string())?;
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
 Ok(c)
}
fn read_orders(c:&Connection)->Result<Vec<Order>,String>{
 let mut stmt=c.prepare("SELECT id,created,client,COALESCE(phone,''),COALESCE(link,''),deposit,withdrawal,blogger FROM orders ORDER BY id DESC").map_err(|e|e.to_string())?;
 let iter=stmt.query_map([],|r|Ok(Order{id:r.get(0)?,created:r.get(1)?,client:r.get(2)?,phone:r.get(3)?,link:r.get(4)?,deposit:r.get(5)?,withdrawal:r.get(6)?,blogger:r.get(7)?})).map_err(|e|e.to_string())?;
 iter.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
fn validate(x:&OrderInput)->Result<(),String>{
 if x.client.trim().is_empty(){return Err("Informe o nome da cliente".into())}
 if [x.deposit,x.withdrawal,x.blogger].iter().any(|v|!v.is_finite()||*v<0.0){return Err("Valores devem ser positivos e válidos".into())}
 Ok(())
}
#[tauri::command]
fn list_orders()->Result<Vec<Order>,String>{authenticated()?;read_orders(&database()?)}
#[tauri::command]
fn save_order(input:OrderInput,id:Option<i64>)->Result<(),String>{
 authenticated()?;validate(&input)?;let c=database()?;
 if let Some(id)=id {
  c.execute("UPDATE orders SET client=?,phone=?,link=?,deposit=?,withdrawal=?,blogger=? WHERE id=?",params![input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger,id]).map_err(|e|e.to_string())?;
 }else{
  c.execute("INSERT INTO orders(created,client,phone,link,deposit,withdrawal,blogger) VALUES(?,?,?,?,?,?,?)",params![chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger]).map_err(|e|e.to_string())?;
 }Ok(())
}
#[tauri::command]
fn delete_order(id:i64)->Result<(),String>{authenticated()?;database()?.execute("DELETE FROM orders WHERE id=?",params![id]).map_err(|e|e.to_string())?;Ok(())}
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
 authenticated()?;let mut c=database()?;let rows=read_orders(&c)?;
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
 tx.execute("DELETE FROM orders",[]).map_err(|e|e.to_string())?;
 tx.commit().map_err(|e|e.to_string())?;
 Ok(file.display().to_string())
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
 tauri::Builder::default()
 .invoke_handler(tauri::generate_handler![login_operator,logout_operator,current_operator,list_orders,save_order,delete_order,get_notes,set_notes,open_data_folder,export_closing,updates::check_for_updates,updates::download_and_install_update])
 .run(tauri::generate_context!()).expect("Erro ao iniciar PEAK Dashboard");
}
