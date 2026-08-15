# ADR 0007: 要素編集と選択履歴

- Status: Accepted
- Date: 2026-08-16

## Decision

- Vertex / Edge / Face選択は対象Vertex IDのSetへ変換し、共有頂点を1回だけ変形する。
- 複数オブジェクトのメッシュ変更は`CompositeCommand`で1履歴にまとめる。
- Transformのピボットは選択頂点全体の重心とする。
- 軸制限は相対数値入力の未変更軸を移動・回転では0、スケールでは1にすることで表現する。
- トポロジーCommandは操作前後のEditableMesh cloneを保持する。
- 要素削除CommandにはSelection snapshotも関連付け、削除直後は無効IDを除去し、Undo時にトポロジーと選択を同時復元する。

## Consequences

移動・回転・スケール・削除を同じ履歴機構で確実に復元できる。初期実装は正しさを優先してmesh snapshotを使い、メモリ最適化は計測後に差分方式を検討する。
