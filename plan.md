# RelayDeck 実装計画

## 1. 定義

RelayDeckは、macOS上でSSH接続先を検索・整理し、接続時だけiTerm2を開く軽量デスクトップアプリである。内蔵ターミナルや認証情報の保管機能は持たない。

## 2. 確定要件

- SSH接続先の単一の正は `~/.ssh/config` とする
- `Include` された設定ファイルも読み込む
- ワイルドカードだけの `Host` は接続先一覧に表示しない
- 表示名、フォルダ、タグ、お気に入り、メモはアプリ専用JSONに保存する
- 検索は別名、接続先、ユーザー、タグ、フォルダ、メモを対象にする
- 接続履歴は成功した「iTerm2起動要求」を日時と回数で記録する
- SSH接続は `ssh <Host別名>` とし、設定値を二重管理しない
- iTerm2は新規ウィンドウまたは既存ウィンドウの新規タブで開く
- 将来はRDP、VNC、HTTP、HTTPSを同じランチャー境界へ追加できる
- パスワード、秘密鍵、秘密鍵パスフレーズは保存しない

## 3. 技術選定

### 採用

- Tauri 2: macOSのWebViewを使う軽量な配布単位と、OS機能をRust側へ閉じ込められるため
- Vanilla TypeScript + Vite: MVPの状態量ではUIフレームワークを増やさず保守できるため
- Rust標準ライブラリ + serde: SSH設定の読み込み、ローカルJSON、プロセス起動を明示的に制御するため
- アプリデータJSON: メタデータ量が小さく、バックアップと移行が容易なため

### 見送り

- SQLite: 現時点のデータ規模と単一ユーザー用途には過剰。複数端末同期や大量履歴が必要になれば移行する
- Electron: 実装速度は高いが、今回は軽量性を優先する
- iTerm2 URL scheme: SSHコマンドの細かな起動制御と引数処理がAppleScriptより不透明なため
- `~/.ssh/config` の自動編集: コメントやInclude構造を壊す危険があるため、MVPは読み取り専用にする

## 4. 実装フェーズ

1. 設計文書とデータモデルを固定する
2. SSH config parser、JSON永続化、iTerm2 launcherをRustで実装する
3. 3ペインUI、検索、フォルダ、タグ、お気に入り、履歴を実装する
4. parserとUI状態ロジックを自動テストする
5. macOSでTauriアプリをビルドし、実データで手動確認する

## 5. 完了条件

- `npm test` と `npm run build` が成功する
- Rust導入後に `npm run tauri build -- --bundles app` が成功する
- 実際の `~/.ssh/config` から接続先が読み込まれる
- 接続操作でiTerm2が開き、Host別名への `ssh` が実行される
- メタデータを変更して再起動しても保持される
- SSH configを変更して再読込すると一覧が更新される

## 6. 未完了・後続候補

- SSH configの安全な編集支援
- RDP、VNC、HTTP、HTTPSランチャー
- メタデータのimport/export
- iCloud Drive等を使った任意同期
- コード署名、公証、自動更新
