# RelayDeck

`~/.ssh/config` の接続先をRoyal TSX風の一覧で整理し、iTerm2で開くmacOS用接続マネージャ。内蔵ターミナルと認証情報ストアは持たない。

対応環境はApple Silicon Mac、macOS 12以降。Intel Mac非対応。

## 主な機能

- OpenSSH configとInclude先から接続先を読込
- 検索、フォルダ、タグ、お気に入り
- 共通アクセントカラーの変更
- 最近の接続と接続回数
- iTerm2の新規ウィンドウまたは新規タブで接続
- ブラウザだけで確認できるデモデータ

## 開発

必要: Node.js、Rust、macOS Command Line Tools、iTerm2

```sh
npm ci
npm test
npm run tauri dev
```

ブラウザUIのみ:

```sh
npm run dev
```

macOSアプリのビルド:

```sh
rustup target add aarch64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg
```

`develop`へpushでテスト用DMGがGitHub ActionsのArtifactに保存。`v0.2.0`のようなバージョンタグのpushでDMG付きDraft Releaseを作成。

## データ

- SSH接続定義: `~/.ssh/config`（読み取り専用）
- 整理用メタデータ: macOSのアプリデータ領域にある `state.json`
- パスワード、秘密鍵、パスフレーズ: 保存しない

設計の経緯は [plan.md](plan.md)、[要件定義](docs/requirements.md)、[アーキテクチャ](docs/architecture.md)を参照。

環境構築、起動、テスト、アプリ生成は [開発環境構築・運用手順書](docs/development.md)を参照。

## セキュリティ

脆弱性の報告は [SECURITY.md](SECURITY.md) に従う。SSH接続先、秘密鍵、認証情報は公開Issueへ書かない。

## ライセンス

未選定。ライセンスファイルが追加されるまで、再利用・再配布の許諾は付与しない。

---

[risoverse.co.jp](https://risoverse.co.jp/)
