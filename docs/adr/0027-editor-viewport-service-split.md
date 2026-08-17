# ADR 0027: Editor / Viewportの計算責務を分割する

## Status

Accepted

## Decision

- Editorからトポロジー隣接選択とQuad Edge Loop計算を`selection/topologySelection`へ分離する。
- Viewportから選択頂点展開、ワールドPivot、スナップ候補生成を`transform/elementSelection`へ分離する。
- 分離した処理はEditorやDOMの状態を所有せず、入力から結果を返す計算モジュールとする。
- Edge隣接グラフは全辺の二重走査ではなく、頂点ごとのincident edge indexから構築する。

## Consequences

- EditorとViewportは状態遷移・描画ライフサイクルへ集中できる。
- 選択・Transform計算を単独で性能測定、回帰テスト、再利用できる。
- Rendererや履歴を伴わず、大規模メッシュの選択計算を測定できる。
