# ADR 0034: 選択要素のTransform Frame

## 状況

要素ギズモは選択頂点の平均位置に表示していたが、軸は常にWorld固定だった。面の法線方向や回転済みObjectのローカル方向へ編集するには、位置だけでなく向きを持つ共通フレームが必要になる。

## 決定

- Transform Frameを重心位置とQuaternionの組としてViewport計算層に置く。
- Worldは単位Quaternion、Localは先頭選択ObjectのWorld回転を使う。
- Normalは明示選択または選択頂点に隣接する面の平均法線をZ軸とし、選択EdgeまたはObjectのX軸を接線へ投影してX軸を定める。
- Local / NormalではThree.js TransformControlsをlocal spaceで動かす。
- 操作開始時のFrame行列を保持し、ライブプレビューと確定差分に同じWorld変換を使う。

## 結果

選択要素の重心を基準にWorld / Local / Normal軸で移動・回転・拡大縮小できる。複数Object選択時の向きは、Outliner順で最初の選択Objectを代表とする。
