# Renderer parity report

確認日: 2026-08-17

## 確認対象

同じ保存済みPlaneメッシュ、透視カメラ、Vertex / Edge / Face全表示で、`?renderer=webgpu`と`?renderer=webgl2`を比較した。

| 項目                    | WebGPU | WebGL 2 | 差異     |
| ----------------------- | ------ | ------- | -------- |
| 背景・Grid・XYZ軸       | 正常   | 正常    | 観測なし |
| 面の色・ライティング    | 正常   | 正常    | 観測なし |
| Vertex 4px表示          | 正常   | 正常    | 観測なし |
| Edge表示                | 正常   | 正常    | 観測なし |
| カメラ構図              | 一致   | 一致    | 観測なし |
| UI内の頂点・面集計      | 8 / 5  | 8 / 5   | なし     |
| Console warning / error | 0      | 0       | なし     |

WebGPUは`WebGPU 対応`、強制WebGL 2は`WebGL 2 フォールバック`と表示され、要求したバックエンドで初期化されたことを確認した。

## 回帰方法

- PlaywrightはWebGL 2を常時検証する。
- 実行環境に`navigator.gpu`がある場合、WebGPUでもViewport、プリミティブ生成、集計表示を検証する。
- GPUドライバーに依存するピクセル単位のアンチエイリアス差は許容し、形状、オーバーレイ、色の明確な欠落を表示差として扱う。
