# ADR 0039: トポロジー操作の生成要素を選択する

## 状況

トポロジー操作の確定後は常に選択が空になり、Loop Cut、Extrude、Bevelを続けるたびに生成要素を探し直す必要があった。

## 決定

- `Editor.#applyTopology`へ任意の結果選択関数を渡せるようにする。
- 再構築時に元Vertexを先頭、新Vertexを末尾へ置く既存契約を利用し、新Vertexだけを結ぶEdgeと新VertexだけのFaceを生成要素として判定する。
- Loop Cut後は新Edge Loopを選択する。
- Extrude後は先端Faceとその境界Edgeを選択し、Extrudeの再実行とBevelのどちらにも進めるようにする。
- Bevel後は新しいCap FaceとEdgeを選択する。
- Undo / Redoには操作前後の選択を既存のSelection Historyで保存する。
- Loop Cutの位置入力も他のモデリング操作と同じライブプレビューダイアログへ統一する。

## 結果

生成物が緑で即座に確認でき、Loop Cut → Face選択 → Extrude → Bevelを少ない選択操作で連続実行できる。
