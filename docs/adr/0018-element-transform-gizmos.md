# ADR 0018: 要素Transformギズモの確定境界

## 決定

Vertex / Edge / Faceの移動・回転・拡大縮小は、共通の選択中心Pivotへ`TransformControls`を接続する。ドラッグ中はViewport内の描画Geometryだけを更新し、確定時に変更対象の`ObjectId`、`VertexId`、ローカル座標をEditor Coreへ渡して1つのCommandとして記録する。

## 理由

Three.jsの行列をEditor Coreへ持ち込まず、Object Transformがある場合や複数Objectをまたぐ選択でも、Viewportが算出した最終ローカル座標を正確に保存できる。ドラッグ中の高頻度更新を履歴やReact stateから分離でき、Undo / Redoは操作単位に保たれる。

## 帰結

Transformの種類を追加しても確定経路は共通化できる。描画オーバーレイはプレビュー座標に追従させ、確定後はEditor snapshotから通常同期し直す。
