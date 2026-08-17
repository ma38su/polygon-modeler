# ADR 0035: メッシュ診断と法線表示を分離する

## 決定

- 境界Edge、非manifold Edge、退化Face、孤立Vertexの集計をEditorの純粋な診断関数として実装する。
- 開いたサーフェスは境界Edgeを報告するが、編集可能な正常メッシュとして扱う。
- 面法線はNewell法でn-gonから算出し、Viewportの独立したNormal表示レイヤーで描画する。
- 法線レイヤーは初期状態OFFとし、選択対象やVertex / Edge / Face表示から独立させる。

## 結果

Inspectorで選択Objectの構造上の問題を確認でき、面の向きをViewport上で検証できる。診断計算はWebGPU / WebGLのどちらにも依存しない。
