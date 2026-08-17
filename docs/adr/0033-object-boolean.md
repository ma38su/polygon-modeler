# ADR 0033: Object Booleanを遅延ロードする

## 状況

Union / Subtract / Intersectには三角形同士の交差、分割、内外判定が必要であり、Editor Coreへ独自の簡易実装を置くと堅牢性と保守性を損なう。通常の編集ではBoolean依存コードを読み込む必要もない。

## 決定

- `three-bvh-csg` 0.0.18をEditorのBoolean境界層から動的importする。
- Outliner順の2つの閉じた立体をワールド座標へ焼き込み、三角形化して演算する。
- 結果は位置で頂点溶接し、退化・重複三角形を除去して`EditableMesh`へ戻す。
- 元Objectの削除と結果Objectの追加を1つのComposite CommandとしてUndo可能にする。
- 演算中に入力Objectが削除された場合は結果を適用しない。

## 結果

- Union / Subtract / Intersectをローカル実行でき、通常起動のappチャンクからCSG実装を分離できる。
- 入力は閉じた2-manifoldに限定される。ライブラリ側にも数値精度と特殊な交差ケースの制約があるため、失敗は編集メッシュへ適用せずエラー表示する。
