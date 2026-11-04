use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

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
fn list_orders()->Result<Vec<Order>,String>{read_orders(&database()?)}
#[tauri::command]
fn save_order(input:OrderInput,id:Option<i64>)->Result<(),String>{
 validate(&input)?;let c=database()?;
 if let Some(id)=id {
  c.execute("UPDATE orders SET client=?,phone=?,link=?,deposit=?,withdrawal=?,blogger=? WHERE id=?",params![input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger,id]).map_err(|e|e.to_string())?;
 }else{
  c.execute("INSERT INTO orders(created,client,phone,link,deposit,withdrawal,blogger) VALUES(?,?,?,?,?,?,?)",params![chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),input.client.trim(),input.phone,input.link,input.deposit,input.withdrawal,input.blogger]).map_err(|e|e.to_string())?;
 }Ok(())
}
#[tauri::command]
fn delete_order(id:i64)->Result<(),String>{database()?.execute("DELETE FROM orders WHERE id=?",params![id]).map_err(|e|e.to_string())?;Ok(())}
#[tauri::command]
fn get_notes()->Result<String,String>{
 let c=database()?;let mut stmt=c.prepare("SELECT v FROM meta WHERE k='notes'").map_err(|e|e.to_string())?;
 let mut rows=stmt.query([]).map_err(|e|e.to_string())?;
 Ok(rows.next().map_err(|e|e.to_string())?.map(|r|r.get(0).unwrap_or_default()).unwrap_or_default())
}
#[tauri::command]
fn set_notes(text:String)->Result<(),String>{
 database()?.execute("INSERT INTO meta(k,v) VALUES('notes',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",params![text]).map_err(|e|e.to_string())?;Ok(())
}
#[tauri::command]
fn open_data_folder()->Result<(),String>{open::that(folder()?).map_err(|e|e.to_string())}
#[tauri::command]
fn export_closing()->Result<String,String>{
 let mut c=database()?;let rows=read_orders(&c)?;
 if rows.is_empty(){return Err("Nenhuma operação para fechar".into())}
 let dir=folder()?.join("Fechamentos");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 let file=dir.join(format!("Fechamento_{}.csv",chrono::Local::now().format("%Y-%m-%d_%H-%M-%S")));
 let mut csv=String::from("\u{feff}Data;Nome da cliente;Telefone;Link;Depósito;Saque;Blogueira;Lucro líquido\r\n");
 for r in rows.iter().rev(){
  let q=|s:&str|format!("\"{}\"",s.replace('"',"\"\"").replace('\r'," ").replace('\n'," "));
  csv.push_str(&format!("{};{};{};{};{:.2};{:.2};{:.2};{:.2}\r\n",q(&r.created),q(&r.client),q(&r.phone),q(&r.link),r.deposit,r.withdrawal,r.blogger,r.withdrawal+r.blogger-r.deposit).replace('.',","));
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
 .invoke_handler(tauri::generate_handler![list_orders,save_order,delete_order,get_notes,set_notes,open_data_folder,export_closing])
 .run(tauri::generate_context!()).expect("Erro ao iniciar PEAK Dashboard");
}
