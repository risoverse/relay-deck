# RelayDeck 開発環境構築・運用手順書

## 1. 定義

RelayDeckは、macOS向けのTauri 2デスクトップアプリである。画面はTypeScriptとVite、macOS連携とSSH config読込はRustで実装している。

プロジェクトをcloneまたは展開したディレクトリを、以下では `<project-directory>` と表記する。

```text
<project-directory>
```

SSH接続定義は `~/.ssh/config` を単一の正とする。RelayDeckはSSH configを読み取るだけで変更しない。フォルダ、タグ、お気に入り、メモ、接続履歴だけをアプリ専用JSONへ保存する。

## 2. 推奨開発環境

開発とCIでは次の環境を使用する。

| 項目 | 推奨環境 |
|---|---|
| macOS | macOS 12以降 |
| Node.js | 22系 |
| npm | `package-lock.json` と互換性のあるバージョン |
| Rust | stable |
| Tauri | 2系、プロジェクトの依存として導入 |
| Xcode | XcodeまたはCommand Line Tools導入済み |

`node_modules` とRustのビルドキャッシュには依存せず、`package-lock.json` と `Cargo.lock` から再構築できる状態を維持する。

## 3. このMacで開発を再開する

### 3.1 プロジェクトへ移動

```sh
cd <project-directory>
```

### 3.2 Rustを現在のシェルで有効にする

`cargo --version` が成功する場合は不要。`cargo: command not found` になる場合だけ実行する。

```sh
source "$HOME/.cargo/env"
```

確認する。

```sh
node --version
npm --version
cargo --version
rustc --version
```

### 3.3 依存関係を復元する

通常は初回、`package-lock.json` 更新後、または `node_modules` を作り直すときだけ実行する。

```sh
npm ci
```

`npm ci` はロックファイルどおりにクリーンな依存関係を復元する。パッケージを追加・更新するときは `npm install <package>` を使い、`package-lock.json` も一緒に更新する。

### 3.4 デスクトップアプリを起動する

```sh
npm run tauri dev
```

RelayDeckのウィンドウが開き、実際の `~/.ssh/config` が読み込まれる。初回のiTerm2起動時には、macOSからオートメーション許可を求められる場合がある。

## 4. 別のMacへ新規構築する

### 4.1 必要なアプリ

- macOS 12以降
- iTerm2
- Xcode、またはXcode Command Line Tools
- Node.js 22系
- Rust stable

### 4.2 Xcode Command Line Tools

Xcodeを入れない場合は次を実行し、macOSの案内に従う。

```sh
xcode-select --install
```

確認する。

```sh
xcode-select -p
```

### 4.3 Node.js

既にnvmを使っている場合はNode.js 22系を導入する。

```sh
nvm install 22
nvm use 22
```

確認する。

```sh
node --version
npm --version
```

### 4.4 Rust

Rust公式のrustupを導入し、stableを選ぶ。

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup default stable
```

確認する。

```sh
rustc --version
cargo --version
```

### 4.5 プロジェクト依存関係

プロジェクトへ移動して実行する。

```sh
npm ci
```

続いて、自動テストとビルドを確認する。

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## 5. 日常の開発方法

### 5.1 デスクトップアプリとして開発

通常はこちらを使う。

```sh
npm run tauri dev
```

TypeScriptやCSSを変更すると、画面は原則として自動更新される。Rustを変更した場合はTauri側が再コンパイルする。

### 5.2 画面だけを素早く確認

```sh
npm run dev
```

ブラウザで `http://127.0.0.1:1420/` を開く。ブラウザ版はデモデータを使い、実際のSSH configやiTerm2には触れない。レイアウト、検索、フォルダ、タグなどのUI確認に向いている。

### 5.3 テスト

画面側のテストを実行する。

```sh
npm test
```

Rust側のSSH configパーサーなどをテストする。

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

Rustの書式を整え、確認する。

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

### 5.4 変更完了時の品質確認

少なくとも次をすべて成功させる。

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

SSH configの読込、メタデータ保存、iTerm2起動に関係する変更では、`npm run tauri dev` でも手動確認する。

## 6. macOSアプリを生成する

```sh
npm run tauri build -- --bundles app
```

成功すると次にアプリが作られる。

```text
src-tauri/target/release/bundle/macos/RelayDeck.app
```

現在のビルドは開発用で、Apple Developer IDによる署名と公証は行っていない。他のMacへ配布するとGatekeeperの警告が出る可能性がある。一般配布の前にコード署名、公証、更新方式を追加する。

## 7. ファイル構成

```text
RelayDeck/
├── .local-project.yml       プロジェクトの要約と主要コマンド
├── plan.md                  実装計画と完了条件
├── README.md                概要
├── docs/
│   ├── architecture.md      アーキテクチャとデータ所有権
│   ├── requirements.md      要件定義
│   └── development.md       本手順書
├── src/
│   ├── main.ts              画面と操作
│   ├── styles.css           画面デザイン
│   ├── api.ts               Tauri APIとブラウザ用デモ
│   ├── filter.ts            検索と絞り込み
│   └── types.ts             共通型
├── src-tauri/
│   ├── src/lib.rs           保存とiTerm2起動
│   ├── src/ssh_config.rs    SSH configパーサー
│   └── tauri.conf.json      macOSアプリ設定
├── package-lock.json        Node.js依存の固定
└── src-tauri/Cargo.lock     Rust依存の固定
```

## 8. データと安全性

### SSH config

RelayDeckは次を読み取り専用で扱う。

```text
~/.ssh/config
```

`Include` されたファイルも読む。パスワード、秘密鍵、秘密鍵のパスフレーズは保存しない。

### RelayDeckメタデータ

フォルダ、タグ、お気に入り、メモ、接続履歴はmacOSのアプリデータ領域にある `state.json` へ保存される。想定パスは次のとおり。

```text
~/Library/Application Support/app.relaydeck.desktop/state.json
```

初期化したい場合は削除せず、RelayDeckを終了してからバックアップ名へ移動する。

```sh
mv "$HOME/Library/Application Support/app.relaydeck.desktop/state.json" \
   "$HOME/Library/Application Support/app.relaydeck.desktop/state.json.backup"
```

## 9. よくある問題

### `cargo: command not found`

```sh
source "$HOME/.cargo/env"
```

毎回必要になる場合は、利用中のシェル設定でRustの環境読込を有効にする。

### ポート1420が使用中

別の `npm run dev` または `npm run tauri dev` が動いていないか確認し、以前の開発プロセスを終了してから再実行する。ViteのポートはTauri設定と一致させる必要があるため、勝手に別ポートへ変更しない。

### iTerm2が開かない

1. iTerm2が `/Applications` にインストールされているか確認する
2. macOSの「システム設定」、「プライバシーとセキュリティ」、「オートメーション」でRelayDeckからiTerm2への操作を許可する
3. `~/.ssh/config` に対象のHost別名が存在するか確認する

### 接続先が一覧に出ない

- `Host *` や `Host *.example.com` のようなパターンは意図的に一覧へ出さない
- 具体的な `Host server-name` が必要
- 画面右上の再読込ボタンでSSH configを読み直す
- 画面下部に警告が出ていないか確認する

### 未署名アプリの警告

開発ビルドを別のMacで開くと警告される場合がある。継続配布では、その警告を回避する操作を利用者へ要求せず、Apple Developer IDによる署名と公証を正式に導入する。

## 10. 継続開発の優先順位

1. 実際のSSH config構成を使った読込確認とパーサー拡充
2. メタデータのimport、export、バックアップ
3. RDP、VNC、HTTP、HTTPSランチャー
4. キーボード操作とアクセシビリティ改善
5. コード署名、公証、配布方法
6. 自動更新

新しい作業を始める前に `.local-project.yml`、`plan.md`、本手順書を読む。要件や設計判断を変更した場合は、実装だけでなく `docs/requirements.md` と `docs/architecture.md` も同時に更新する。

## 11. 修正履歴

### 0.1.1

- macOSの3色ウィンドウボタンとRelayDeckロゴの重なりを解消
- タイトルバーのドラッグ権限を追加
- ロゴと上部の空き領域から、ディスプレイをまたいでウィンドウを移動できるよう改善
