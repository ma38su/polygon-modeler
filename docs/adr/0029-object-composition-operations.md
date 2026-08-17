# ADR 0029: Object複製・結合とFace分離

## Status

Accepted

## Decision

- OutlinerはShift+クリックで複数Objectを選択できる。
- DuplicateはMesh、Transform、表示状態を複製する。
- Joinは各Object Transformを頂点座標へ焼き込み、Identity Transformの単一Objectを作る。
- Separateは選択Faceと残りのFaceをそれぞれcompactなMeshへ再構築する。
- Duplicate、Delete、Separate、Joinはすべて1回のComposite CommandとしてUndo可能にする。

## Consequences

- 異なるTransformのObjectを見た目の位置を変えずに統合できる。
- Faceをすべて選択したSeparateは、同一形状のObject置換を避けるため何も行わない。
