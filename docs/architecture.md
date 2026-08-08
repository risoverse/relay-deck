# アーキテクチャ

## 1. 定義

UIは接続先の整理と選択だけを担当し、OpenSSHとiTerm2を既存の実行基盤として利用する。

```text
~/.ssh/config (read-only)
        |
        v
Rust backend: parse / merge metadata / launch
        |
        v
TypeScript UI: browse / search / edit metadata
        |
        v
iTerm2 -> ssh <alias> -> OpenSSH resolves actual settings
```

## 2. データ所有権

| データ | 所有者 | 保存先 |
|---|---|---|
| Host、HostName、User、Port、ProxyJump、IdentityFile | OpenSSH | `~/.ssh/config` とInclude先 |
| 表示名、フォルダ、タグ、お気に入り、メモ | RelayDeck | app data `state.json` |
| 最終接続日時、接続回数 | RelayDeck | app data `state.json` |
| パスワード、鍵、パスフレーズ | 保存しない | なし |

## 3. 境界

Rustコマンドは `get_catalog`、`save_metadata`、`launch_connection` の3系統とする。UIから任意コマンドは実行できない。ランチャーはプロトコルごとの実装を持ち、MVPではSSHのみ有効にする。

## 4. iTerm2起動

`/usr/bin/osascript` に固定AppleScriptを渡し、Host別名とウィンドウ動作はargvで受け取る。AppleScriptはargvから `ssh` の単一引数として安全にクォートした文字列を生成する。Host別名はOpenSSH config由来かつ改行とNULを拒否する。

## 5. 将来拡張

`ConnectionKind` とランチャーを分離し、RDPはMicrosoft Windows App等、VNCはScreen Sharing、HTTP/HTTPSは既定ブラウザへ委譲する。UIの一覧、検索、メタデータはプロトコル非依存とする。
