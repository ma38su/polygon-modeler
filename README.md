# Polygon Modeler

ブラウザ内で完結するローカルファーストのポリゴンモデラーです。実装計画のPhase 0〜11を完了したMVPです。Box、Plane、Cylinderからポリゴン編集を始め、独自形式で保存し、GLB / STLとして出力できます。

## 開発

```sh
npm install
npm run dev
```

## 品質チェック

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

設計上の初期決定は[ADR 0001](docs/adr/0001-project-foundation.md)を参照してください。

操作方法は[操作ガイド](docs/USER_GUIDE.md)、性能検証と既知の制限は[安定化レポート](docs/STABILITY.md)を参照してください。

## コードの境界

- `src/editor`: UIや描画環境に依存しないEditor Core
- `src/viewport`: 描画、カメラ、入力、描画アダプター
- `src/ui`: React UI
- `src/app`: アプリ統合、Provider、ショートカット

描画バックエンドを固定して確認する場合は、URLへ`?renderer=webgl2`または`?renderer=webgpu`を追加します。

## 対象ブラウザ

- Chrome / Edgeの現行安定版（WebGPU優先）
- Firefox / Safariの現行安定版（WebGL 2フォールバック）

自動ブラウザ回帰テストはChromiumで実施しています。他ブラウザはWebGL 2の手動スモークテスト対象です。

## GitHub Pagesへのデプロイ

`main`へのpushまたは手動実行で、GitHub Actionsがlint、型検査、単体テスト、Chromium E2E、Production buildを実行し、成功した`dist`をGitHub Pagesへ公開します。リポジトリ配下のURLではリポジトリ名をViteのベースパスとして自動設定し、`<owner>.github.io`リポジトリではルートパスを使用します。

初回のみGitHubリポジトリのSettings → Pages → Build and deployment → Sourceで`GitHub Actions`を選択してください。ワークフローは[deploy-pages.yml](.github/workflows/deploy-pages.yml)です。
