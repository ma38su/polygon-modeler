# ADR 0021: モデリング操作のライブプレビュー

## 決定

数値入力を伴うモデリング操作は、Editor Coreが現在のDocumentと選択から副作用のないプレビューsnapshotを生成する。React UIはプレビューの生存期間と入力値を管理し、Viewportへ通常snapshotの代わりに一時表示する。確定時だけ既存のCommandを実行し、キャンセル時はプレビューsnapshotを破棄する。

プレビュー更新ごとに`geometryEpoch`を増やし、内部mesh revisionが確定モデルと一致してもRenderGeometryAdapterがGeometryを確実に再構築する。プレビュー中は選択オーバーレイとTransformギズモを停止する。

## 理由

Editor DocumentやUndo履歴を仮操作で汚さず、確定とキャンセルを明確に分離できる。snapshot生成APIを共通境界にすることで、今後のインセット、ベベル、分割パラメーターにも同じ表示経路を利用できる。

## 帰結

最初の対応操作は面の押し出しとする。押し出し量の変更は即時にViewportへ反映されるが、ステータス、保存対象、Undo履歴は確定まで変更されない。
