mod ssh_config;

use serde::{Deserialize, Serialize};
use ssh_config::ParsedHost;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostMetadata {
    alias: String,
    display_name: String,
    folder: String,
    tags: Vec<String>,
    favorite: bool,
    note: String,
    last_connected_at: Option<u64>,
    connection_count: u64,
}

#[derive(Default, Deserialize, Serialize)]
struct AppState {
    #[serde(default)]
    metadata: BTreeMap<String, HostMetadata>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogHost {
    #[serde(flatten)]
    ssh: ParsedHost,
    metadata: HostMetadata,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Catalog {
    hosts: Vec<CatalogHost>,
    config_path: String,
    warnings: Vec<String>,
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("state.json"))
        .map_err(|error| format!("アプリデータの保存先を取得できません: {error}"))
}

fn read_state(app: &tauri::AppHandle) -> Result<AppState, String> {
    let path = state_path(app)?;
    if !path.exists() {
        return Ok(AppState::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("{} を読み込めません: {error}", path.display()))?;
    serde_json::from_str(&content).map_err(|error| format!("メタデータが壊れています: {error}"))
}

fn write_state(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let path = state_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "保存先が不正です".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("保存先を作成できません: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(state)
        .map_err(|error| format!("メタデータを変換できません: {error}"))?;
    fs::write(&temporary, content)
        .map_err(|error| format!("メタデータを書き込めません: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("メタデータを確定できません: {error}"))
}

fn default_metadata(alias: &str) -> HostMetadata {
    HostMetadata {
        alias: alias.to_string(),
        ..HostMetadata::default()
    }
}

fn ssh_config_path() -> PathBuf {
    ssh_config::home_dir().join(".ssh/config")
}

#[tauri::command]
fn get_catalog(app: tauri::AppHandle) -> Result<Catalog, String> {
    let config_path = ssh_config_path();
    let parsed = ssh_config::parse(&config_path);
    let state = read_state(&app)?;
    let mut hosts: Vec<_> = parsed
        .hosts
        .into_iter()
        .map(|ssh| {
            let metadata = state
                .metadata
                .get(&ssh.alias)
                .cloned()
                .unwrap_or_else(|| default_metadata(&ssh.alias));
            CatalogHost { ssh, metadata }
        })
        .collect();
    hosts.sort_by(|a, b| a.ssh.alias.to_lowercase().cmp(&b.ssh.alias.to_lowercase()));
    Ok(Catalog {
        hosts,
        config_path: config_path.to_string_lossy().into_owned(),
        warnings: parsed.warnings,
    })
}

#[tauri::command]
fn save_metadata(app: tauri::AppHandle, mut metadata: HostMetadata) -> Result<(), String> {
    validate_alias(&metadata.alias)?;
    metadata.tags = metadata
        .tags
        .into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect();
    metadata.tags.sort();
    metadata.tags.dedup();
    let mut state = read_state(&app)?;
    state.metadata.insert(metadata.alias.clone(), metadata);
    write_state(&app, &state)
}

#[tauri::command]
fn launch_connection(
    app: tauri::AppHandle,
    alias: String,
    mode: String,
) -> Result<HostMetadata, String> {
    validate_alias(&alias)?;
    if mode != "window" && mode != "tab" {
        return Err("不正な起動モードです".into());
    }
    let parsed = ssh_config::parse(&ssh_config_path());
    if !parsed.hosts.iter().any(|host| host.alias == alias) {
        return Err("SSH configに存在しない接続先です".into());
    }
    launch_iterm(&alias, &mode)?;
    let mut state = read_state(&app)?;
    let metadata = state
        .metadata
        .entry(alias.clone())
        .or_insert_with(|| default_metadata(&alias));
    metadata.connection_count += 1;
    metadata.last_connected_at = Some(now_millis()?);
    let updated = metadata.clone();
    write_state(&app, &state)?;
    Ok(updated)
}

fn validate_alias(alias: &str) -> Result<(), String> {
    if alias.is_empty() || alias.starts_with('-') || alias.contains(['\n', '\r', '\0']) {
        return Err("不正なHost別名です".into());
    }
    Ok(())
}

fn now_millis() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|error| error.to_string())
}

fn launch_iterm(alias: &str, mode: &str) -> Result<(), String> {
    const SCRIPT: &str = r#"
on run argv
  set targetAlias to item 1 of argv
  set launchMode to item 2 of argv
  set sshCommand to "/usr/bin/ssh -- " & quoted form of targetAlias
  tell application "iTerm2"
    activate
    if launchMode is "tab" and (count of windows) > 0 then
      tell current window to create tab with default profile command sshCommand
    else
      create window with default profile command sshCommand
    end if
  end tell
end run
"#;
    let output = Command::new("/usr/bin/osascript")
        .args(["-e", SCRIPT, "--", alias, mode])
        .output()
        .map_err(|error| format!("iTerm2の起動処理を開始できません: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if message.is_empty() {
        "iTerm2を起動できません".into()
    } else {
        message
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            save_metadata,
            launch_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running RelayDeck");
}
