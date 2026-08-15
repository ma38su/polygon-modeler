# ADR 0004: Command履歴とドラッグ確定

- Status: Accepted
- Date: 2026-08-16

## Decision

- ドキュメントを変更する作成・削除・Transformは`EditorCommand`として実行する。
- `CommandHistory`はUndoとRedoの2スタックを所有し、Undo後の新規CommandでRedoスタックを破棄する。
- Transformギズモは描画中のThree.js Meshをプレビューとして直接更新し、ドラッグ開始値と終了値からmouseUp時に1つの`TransformObjectCommand`を確定する。
- Inspector数値入力も同じTransform Commandを使用し、ギズモと結果を一致させる。
- ショートカットは入力欄へフォーカスがある場合に発火させない。

## Consequences

フレームごとのポインター移動で履歴が増えず、Undo/Redoの意味単位がユーザー操作と一致する。将来の頂点・辺・面Transformも同じドラッグ確定方式を再利用できる。
