# ADR 0001: プロジェクト基盤

- Status: Accepted
- Date: 2026-08-16

## Decision

- パッケージマネージャーはnpmとし、`package-lock.json`をコミットする。
- 対象は最新安定版のChrome、Edge、Firefox、Safariとする。WebGPUを優先し、利用不可時はWebGL 2へフォールバックする。
- 内部座標系は右手系、Y-upとする。
- 内部長さ単位はメートルとし、3Dプリント用出力時にミリメートルへ変換する。
- 表面は外側から見て反時計回りの頂点順序（CCW）とする。
- 基本ショートカットはUndoを`Ctrl/Cmd+Z`、Redoを`Ctrl/Cmd+Shift+Z`、全選択を`Ctrl/Cmd+A`、選択解除を`Alt+A`、削除を`Delete/Backspace`とする。
- 独自プロジェクトファイルの拡張子は`.polyproj`とする。
- Editor CoreはReact、Three.js、DOMに依存させない。
- UIアイコンは`lucide-react`に統一する。

## Consequences

描画バックエンド、UI、編集モデルを分離して段階的に実装できる。交換形式への出力では座標、単位、面の向きを明示的に変換する。
