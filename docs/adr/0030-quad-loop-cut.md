# ADR 0030: 四角面Edge LoopのLoop Cut

## Status

Accepted

## Decision

- Edge Loop選択とLoop Cutは`mesh/edgeLoop`の同じ巡回関数を使う。
- 選択Edgeから各四角面の反対Edgeをたどり、ループを収集する。
- ループEdgeへ指定率の頂点を作り、2本の反対Edgeを含むQuadを2つのQuadへ分割する。
- 初期UIでは中央（0.5）へ1本のLoopを作る。

## Consequences

- BoxやQuad Stripへ連続したLoop Cutを1つのUndo可能な操作として適用できる。
- Triangle、N-gon、Poleを横断するLoop推定と複数分割数は将来拡張とする。
