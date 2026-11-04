use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, process::Command, time::Duration};

const RELEASE_API: &str = "https://api.github.com/repos/micaelchines0-rgb/PEAK-Dashboard/releases/latest";
#[derive(Deserialize)]
struct Asset { name: String, browser_download_url: String }
#[derive(Deserialize)]
struct Release { tag_name: String, html_url: String, assets: Vec<Asset> }
#[derive(Serialize)]
pub struct UpdateInfo { available: bool, current_version: String, latest_version: String, release_url: String }

fn client() -> Result<reqwest::blocking::Client,String> {
 reqwest::blocking::Client::builder().timeout(Duration::from_secs(30)).user_agent("PEAK-Dashboard-Updater").build().map_err(|e|e.to_string())
}
fn latest() -> Result<Release,String> {
 client()?.get(RELEASE_API).send().and_then(|r|r.error_for_status()).and_then(|r|r.json::<Release>()).map_err(|e|format!("Não foi possível consultar as atualizações: {e}"))
}
fn parts(v:&str)->Option<Vec<u64>> {
 let v=v.trim_start_matches('v');
 if v.is_empty() || !v.split('.').all(|s|!s.is_empty() && s.bytes().all(|b|b.is_ascii_digit())) { return None; }
 v.split('.').map(|s|s.parse().ok()).collect()
}
fn newer(latest:&str,current:&str)->bool {
 match (parts(latest),parts(current)) { (Some(a),Some(b))=>a>b,_=>false }
}
#[tauri::command]
pub fn check_for_updates()->Result<UpdateInfo,String>{
 let release=latest()?;
 let current=env!("CARGO_PKG_VERSION").to_string();
 let latest_version=release.tag_name.trim_start_matches('v').to_string();
 let has_installer=release.assets.iter().any(|a|a.name.to_lowercase().ends_with(".exe"));
 Ok(UpdateInfo{available:newer(&latest_version,&current)&&has_installer,current_version:current,latest_version,release_url:release.html_url})
}
#[tauri::command]
pub fn download_and_install_update()->Result<(),String>{
 let release=latest()?;
 let current=env!("CARGO_PKG_VERSION");
 if !newer(&release.tag_name,current) { return Err("Não há atualização mais recente disponível".into()); }
 let installer=release.assets.iter().find(|a|a.name.to_lowercase().ends_with(".exe") && a.name.contains("PEAK")).ok_or("Instalador Windows não encontrado na versão oficial")?;
 let checksum=release.assets.iter().find(|a|a.name==format!("{}.sha256",installer.name)).ok_or("Arquivo de verificação SHA-256 não encontrado")?;
 // Only trust GitHub release assets from the fixed official repository.
 let allowed="https://github.com/micaelchines0-rgb/PEAK-Dashboard/releases/download/";
 if !installer.browser_download_url.starts_with(allowed)||!checksum.browser_download_url.starts_with(allowed) {return Err("Origem do download não autorizada".into());}
 let client=client()?;
 let expected_text=client.get(&checksum.browser_download_url).send().and_then(|r|r.error_for_status()).and_then(|r|r.text()).map_err(|e|e.to_string())?;
 let expected=expected_text.split_whitespace().next().ok_or("Checksum vazio")?.to_ascii_lowercase();
 if expected.len()!=64||!expected.bytes().all(|b|b.is_ascii_hexdigit()){return Err("Checksum inválido".into());}
 let dir=std::env::temp_dir().join("PEAK-Dashboard-Updates");
 fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 let destination=dir.join(format!("PEAK-Dashboard-{}.exe",release.tag_name));
 let mut response=client.get(&installer.browser_download_url).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?;
 let mut file=fs::File::create(&destination).map_err(|e|e.to_string())?;
 let mut hash=Sha256::new();let mut buf=[0u8;65536];let mut size=0u64;
 loop{
  let n=response.read(&mut buf).map_err(|e|e.to_string())?;
  if n==0 {break}
  size+=n as u64;
  if size>250*1024*1024 {return Err("Instalador maior que o limite de segurança".into());}
  hash.update(&buf[..n]);
  std::io::Write::write_all(&mut file,&buf[..n]).map_err(|e|e.to_string())?;
 }
 drop(file);
 let actual=format!("{:x}",hash.finalize());
 if actual!=expected {let _=fs::remove_file(&destination);return Err("Falha na verificação do instalador. Atualização cancelada".into());}
 Command::new(&destination).spawn().map_err(|e|format!("Não foi possível abrir o instalador: {e}"))?;
 Ok(())
}
