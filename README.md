# RelayDeck

RelayDeckは、`~/.ssh/config` の接続先をRoyal TSX風の一覧で整理し、iTerm2で開くmacOS向け接続マネージャです。内蔵ターミナルや認証情報ストアは持ちません。

## 主な機能

- OpenSSH configとInclude先から接続先を読込
- 検索、フォルダ、タグ、お気に入り
- 最近の接続と接続回数
- iTerm2の新規ウィンドウまたは新規タブで接続
- ブラウザだけで確認できるデモデータ

## 開発

必要なものはNode.js、Rust、macOS Command Line Tools、iTerm2です。

```sh
npm ci
npm test
npm run tauri dev
```

ブラウザUIだけを確認する場合は次を実行します。

```sh
npm run dev
```

macOSアプリを作成する場合は次を実行します。

```sh
npm run tauri build -- --bundles app
```

## データ

- SSH接続定義: `~/.ssh/config`。RelayDeckは読み取り専用
- 整理用メタデータ: macOSのRelayDeckアプリデータ領域にある `state.json`
- パスワード、秘密鍵、パスフレーズ: 保存しない

詳しい判断は [plan.md](plan.md)、[要件定義](docs/requirements.md)、[アーキテクチャ](docs/architecture.md)を参照してください。

開発環境の初回構築、日常の起動、テスト、macOSアプリ生成については [開発環境構築・運用手順書](docs/development.md)を参照してください。

## セキュリティ

脆弱性を見つけた場合は [SECURITY.md](SECURITY.md) に従い、SSH接続先、秘密鍵、認証情報を公開Issueへ記載しないでください。

## ライセンス

ライセンスは未選定です。ライセンスファイルが追加されるまで、ソースコードの再利用・再配布に対する許諾は付与されません。
