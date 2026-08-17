# MVP安定化レポート

## 自動検証

- Half-edge不変条件、選択、Command履歴、保存形式、GLB / STL変換をVitestで検証
- 10,000頂点 / 9,801面のグリッドについて、構築・検証・複製・保存アーカイブ復元を2.5秒以内とする回帰基準
- 同じ10,000頂点Gridで連結選択、描画Geometry / Overlay準備、移動Undoを個別計測。上限は[Performance budgets](PERFORMANCE.md)に記録
- ChromiumのProduction buildで作成、選択、編集、Undo / Redo、保存、再読込、自動保存復元、GLB / STL出力、STL再読込をPlaywrightで検証
- WebGPU利用可能環境では、WebGPU / WebGL 2双方のViewport契約を検証。手動比較結果は[Renderer parity report](RENDERER_PARITY.md)に記録
- Viewport破棄時にAnimationFrame、Renderer、Controls、Geometry、Material、イベント、ResizeObserverを解放

## 連続編集・メモリ確認手順

1. Production buildをChromeで開き、DevToolsのPerformance monitorを表示します。
2. Cylinderを10個作成し、選択・Transform・押し出し・Undo / Redoを30分繰り返します。
3. 5分間操作を止め、JS heapとDOM node数が継続的に増えないことを確認します。
4. ページ遷移または再読込後にWebGL context、Geometry、Materialが残留しないことを確認します。

ブラウザのGC時機は非決定的なため、CIでは時間回帰と明示的disposeを検査し、30分ソークはリリース前の手動確認項目とします。

## 既知の制限

- UV、テクスチャ、マテリアル編集、Boolean、スカルプト、アニメーションには未対応です。
- トポロジー確定後は対象メッシュ内の要素IDを再構築し、要素選択を解除します。Undoでは元のIDと選択を復元します。
- 面生成は、同一オブジェクトの境界上にある3個以上の頂点を順番に選択する基本版です。
- GLB読込は静的な三角形メッシュが対象です。マテリアル、テクスチャ、スキン、アニメーションは取り込みません。
- STLは単位メタデータを持たないため、ミリメートルとして扱います。
- 自動E2Eの対象はChromiumです。Firefox / SafariはWebGL 2手動確認対象です。
- Vite buildではThree.js本体チャンクが500 kBを超える警告が出ます。交換形式処理は遅延チャンクへ分離済みです。
