# ADR 0028: 依存ライブラリ単位のバンドル分割

## Status

Accepted

## Decision

- Vite 8の`rolldownOptions.output.codeSplitting`を使用する。
- React、Three.js、Lucideをアプリケーションコードと別のキャッシュ可能なチャンクにする。
- Three.jsグループは400KBを上限目安として複数チャンクへ分割する。
- GLB / STL変換の既存Dynamic Importは維持する。

## Consequences

- 初期アプリチャンクと各依存チャンクが500KB警告閾値を下回る。
- ライブラリとアプリの更新頻度が異なる場合にブラウザキャッシュを再利用しやすい。
