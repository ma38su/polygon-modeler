# Polygon Modeler

ブラウザ内で完結するローカルファーストのポリゴンモデラーです。現在は実装計画のPhase 3（Command履歴とオブジェクト編集）までを実装しています。

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

## コードの境界

- `src/editor`: UIや描画環境に依存しないEditor Core
- `src/viewport`: 描画、カメラ、入力、描画アダプター
- `src/ui`: React UI
- `src/app`: アプリ統合、Provider、ショートカット

描画バックエンドを固定して確認する場合は、URLへ`?renderer=webgl2`または`?renderer=webgpu`を追加します。
