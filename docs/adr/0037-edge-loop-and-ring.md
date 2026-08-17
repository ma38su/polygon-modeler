# ADR 0037: Edge LoopとEdge Ringを別の巡回として扱う

## 状況

従来の「ループ」実装は四角面の反対Edgeをたどっており、一般的なモデラーでいうEdge Ringだった。頂点を通るEdge Loopとは停止条件も用途も異なる。

## 決定

- Edge Loopは各頂点で、現在Edgeと四角面を共有しない唯一のEdgeへ進む。
- Poleや分岐で候補が0または複数になる場合は、その方向の巡回を停止する。
- n-gonはLoopの隣接面判定から除外し、CylinderのCapに接する境界Loopを継続可能にする。
- Edge Ringは四角面の反対Edgeを幅優先でたどり、非Quadで停止する。
- Loop Cutは従来どおりEdge Ring巡回を利用する。

## 結果

LoopとRingのUI・API・意味が一致し、境界、Pole、閉ループで決定的な選択結果になる。
