# ADR 0032: Object Mirrorコピー

## Status

Accepted

## Decision

- Outlinerで選択したObjectごとに、ローカルX / Y / Z平面で反転した別Objectを作る。
- 座標の対象軸へ-1を乗算し、全Faceの巻き順を反転して表面法線を維持する。
- 元ObjectのTransformと表示状態はコピーし、元Object自体は変更しない。
- 複数ObjectのMirror作成を1回のComposite Commandとして記録する。

## Consequences

- 元形状を保持した対称コピーを簡単に作成できる。
- 溶接、クリッピング、任意平面Mirrorを備える非破壊Modifierではない。
