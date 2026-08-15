# ADR 0005: Half-edge編集メッシュ

- Status: Accepted
- Date: 2026-08-16

## Decision

- 編集用メッシュはVertex、HalfEdge、Edge、Faceを安定ID付きMapで保持する。
- 境界辺はHalfEdgeが1本のEdgeとして表し、閉じた辺は対称なtwinを持つ2本で表す。
- 面削除は残存要素を再生成せず、既存IDを維持しながらtwinと境界状態を更新する。
- Editor snapshotでは描画境界用のpositionsとNゴンfacesへ変換し、revisionが変わったオブジェクトだけBufferGeometryを再構築する。
- Nゴンは決定的なfan triangulationを使う。MVPプリミティブと基本編集では単純な凸Nゴンを生成する契約とし、凹Nゴン対応は必要な操作導入時にear clippingへ拡張する。
- 開発時の生成・編集処理では不変条件Validatorを実行可能にする。

## Consequences

選択やUndoが配列位置に依存せず、境界を持つPlaneと閉じたBox/Cylinderを同じ構造で編集できる。描画表現は引き続きEditor Coreから分離される。
