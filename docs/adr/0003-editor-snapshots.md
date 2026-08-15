# ADR 0003: Editor Coreと描画同期

- Status: Accepted
- Date: 2026-08-16

## Decision

- `Editor`と`ModelDocument`はReact、Three.js、DOMへ依存しない。
- UI購読には参照が安定した不変扱いの`EditorSnapshot`を使い、変更確定時だけrevisionを更新して通知する。
- IDは配列位置と分離し、削除後も再利用しない。
- Phase 2のMeshDataは位置配列と面インデックスの交換境界に限定し、Phase 4でHalf-edge構造へ置き換える。
- Three.jsのMeshとBufferGeometryは`RenderGeometryAdapter`が所有・破棄する。

## Consequences

Editor Core単体テストはDOMなしで動作し、React再レンダリングとViewport描画更新を分離できる。Phase 4ではUI契約を維持したまま内部トポロジーを導入する。
