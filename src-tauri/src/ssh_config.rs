use glob::glob;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedHost {
    pub alias: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub proxy_jump: Option<String>,
    pub identity_file: Option<String>,
    pub source: String,
}

#[derive(Default)]
pub struct ParseResult {
    pub hosts: Vec<ParsedHost>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Default)]
struct BlockDefaults {
    host_name: Option<String>,
    user: Option<String>,
    port: Option<u16>,
    proxy_jump: Option<String>,
    identity_file: Option<String>,
}

pub fn parse(root: &Path) -> ParseResult {
    let mut result = ParseResult::default();
    let mut visited = HashSet::new();
    parse_file(root, &mut visited, &mut result);
    let mut aliases = HashSet::new();
    result
        .hosts
        .retain(|host| aliases.insert(host.alias.clone()));
    result
}

fn parse_file(path: &Path, visited: &mut HashSet<PathBuf>, result: &mut ParseResult) {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    if !visited.insert(canonical) {
        return;
    }
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            result
                .warnings
                .push(format!("{} を読み込めません: {error}", path.display()));
            return;
        }
    };
    let source = path.to_string_lossy().into_owned();
    let mut current_aliases: Vec<String> = Vec::new();
    let mut values = BlockDefaults::default();
    let mut in_match = false;

    let flush =
        |aliases: &mut Vec<String>, values: &mut BlockDefaults, result: &mut ParseResult| {
            for alias in aliases.drain(..) {
                result.hosts.push(ParsedHost {
                    alias,
                    host_name: values.host_name.clone(),
                    user: values.user.clone(),
                    port: values.port,
                    proxy_jump: values.proxy_jump.clone(),
                    identity_file: values.identity_file.clone(),
                    source: source.clone(),
                });
            }
            *values = BlockDefaults::default();
        };

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (keyword, raw_value) = split_directive(line);
        let key = keyword.to_ascii_lowercase();
        if key == "host" {
            flush(&mut current_aliases, &mut values, result);
            in_match = false;
            current_aliases = words(raw_value)
                .into_iter()
                .filter(|alias| is_concrete_alias(alias))
                .collect();
            continue;
        }
        if key == "match" {
            flush(&mut current_aliases, &mut values, result);
            in_match = true;
            continue;
        }
        if key == "include" {
            if !current_aliases.is_empty() {
                flush(&mut current_aliases, &mut values, result);
            }
            for pattern in words(raw_value) {
                for include in resolve_include(path, &pattern, result) {
                    parse_file(&include, visited, result);
                }
            }
            continue;
        }
        if in_match || current_aliases.is_empty() {
            continue;
        }
        let value = unquote(raw_value.trim());
        match key.as_str() {
            "hostname" if values.host_name.is_none() => values.host_name = Some(value),
            "user" if values.user.is_none() => values.user = Some(value),
            "port" if values.port.is_none() => values.port = value.parse().ok(),
            "proxyjump" if values.proxy_jump.is_none() => values.proxy_jump = Some(value),
            "identityfile" if values.identity_file.is_none() => values.identity_file = Some(value),
            _ => {}
        }
    }
    flush(&mut current_aliases, &mut values, result);
}

fn split_directive(line: &str) -> (&str, &str) {
    if let Some(index) = line.find(|c: char| c.is_whitespace() || c == '=') {
        (
            &line[..index],
            line[index..]
                .trim_start_matches(|c: char| c.is_whitespace() || c == '=')
                .trim(),
        )
    } else {
        (line, "")
    }
}

fn words(value: &str) -> Vec<String> {
    value
        .split_whitespace()
        .map(unquote)
        .filter(|word| !word.is_empty())
        .collect()
}

fn unquote(value: &str) -> String {
    value.trim_matches(|c| c == '"' || c == '\'').to_string()
}

fn is_concrete_alias(alias: &str) -> bool {
    !alias.starts_with('!')
        && !alias.chars().any(|c| matches!(c, '*' | '?' | '[' | ']'))
        && !alias.contains(['\n', '\r', '\0'])
}

fn resolve_include(parent: &Path, pattern: &str, result: &mut ParseResult) -> Vec<PathBuf> {
    let expanded = if let Some(rest) = pattern.strip_prefix("~/") {
        home_dir().join(rest)
    } else {
        let path = PathBuf::from(pattern);
        if path.is_absolute() {
            path
        } else {
            parent.parent().unwrap_or_else(|| Path::new(".")).join(path)
        }
    };
    let pattern_text = expanded.to_string_lossy();
    match glob(&pattern_text) {
        Ok(paths) => paths.filter_map(|item| item.ok()).collect(),
        Err(error) => {
            result
                .warnings
                .push(format!("Includeパターンが不正です: {error}"));
            Vec::new()
        }
    }
}

pub fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_concrete_hosts_and_skips_patterns() {
        let dir = std::env::temp_dir().join(format!(
            "relaydeck-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let config = dir.join("config");
        fs::write(&config, "Host *\n  ServerAliveInterval 20\nHost web-01 web-02\n  HostName 192.0.2.10\n  User demo\n  Port 2202\nHost *.example.com\n  User ignored\n").unwrap();
        let parsed = parse(&config);
        assert_eq!(parsed.hosts.len(), 2);
        assert_eq!(parsed.hosts[0].alias, "web-01");
        assert_eq!(parsed.hosts[0].user.as_deref(), Some("demo"));
        assert_eq!(parsed.hosts[0].port, Some(2202));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn follows_includes_once() {
        let dir = std::env::temp_dir().join(format!(
            "relaydeck-include-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("parts")).unwrap();
        fs::write(dir.join("config"), "Include parts/*.conf\n").unwrap();
        fs::write(
            dir.join("parts/lab.conf"),
            "Host lab\n  HostName 192.0.2.1\n",
        )
        .unwrap();
        let parsed = parse(&dir.join("config"));
        assert_eq!(parsed.hosts.len(), 1);
        assert_eq!(parsed.hosts[0].alias, "lab");
        let _ = fs::remove_dir_all(dir);
    }
}
