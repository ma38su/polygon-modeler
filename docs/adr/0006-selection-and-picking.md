# ADR 0006: 要素選択とCPU picking

- Status: Accepted
- Date: 2026-08-16

## Decision

- 選択状態は`SelectionManager`が安定IDの組として所有し、Object / Vertex / Edge / Faceモードを排他的に切り替える。
- モード変更時は旧モードの要素選択を消去する。
- pickingは交換可能なViewportサービスとしてCPU Raycastから開始する。
- 最前面MeshをRaycastで決めた後、そのMesh内でFaceの三角形対応、Vertexの点距離、Edgeの線分距離を評価する。
- Vertex / Edgeの許容幅はカメラ距離に比例させ、画面上の操作性を維持する。
- Shiftクリックを追加・解除選択、通常クリックを置換選択とする。

## Consequences

Editor CoreはThree.jsへ依存せず、将来ID BufferやGPU pickingへ置換できる。遮蔽された別オブジェクトの要素より最前面オブジェクトを優先できる。
