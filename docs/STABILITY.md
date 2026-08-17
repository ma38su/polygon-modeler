# MVP安定化レポート

## 自動検証

- Half-edge不変条件、選択、Command履歴、保存形式、GLB / STL変換をVitestで検証
- 10,000頂点 / 9,801面のグリッドについて、構築・検証・複製・保存アーカイブ復元を2.5秒以内とする回帰基準
- 同じ10,000頂点Gridで連結選択、描画Geometry / Overlay準備、移動Undoを個別計測。上限は[Performance budgets](PERFORMANCE.md)に記録
- ChromiumのProduction buildで作成、選択、編集、Undo / Redo、保存、再読込、自動保存復元、GLB / STL出力、STL再読込をPlaywrightで検証
- WebGPU利用可能環境では、WebGPU / WebGL 2双方のViewport契約を検証。手動比較結果は[Renderer parity report](RENDERER_PARITY.md)に記録
- Viewport破棄時にAnimationFrame、Renderer、Controls、Geometry、Material、イベント、ResizeObserverを解放

## 連続編集・メモリ確認

`npm run test:memory`は、同一Chromiumページで数値Transform、Undo / Redo、Overlay表示切替を30分継続し、1分ごとに明示GC後のJS heap、DOM node、event listenerを採取します。通常のE2Eからは時間短縮のため除外しています。

2026-08-18のProduction buildでは2,577サイクルを完走しました。2分ウォームアップ後から30分までのJS heapは8.76 MBから8.65 MB、DOM nodeは723で一定、event listenerは249から256で、設定した増加上限内でした。

## 既知の制限

- UV、画像テクスチャ、スカルプト、アニメーションには未対応です。
- Booleanは閉じた2-manifold立体2つに対応します。自己交差、開いた面、同一平面が広く重なる入力では数値誤差により演算できない場合があります。
- KnifeはFace境界上の任意の2点をViewportで指定できます。複数Faceを横断する連続点列Knifeには未対応です。
- Normal Transformは複数Objectにまたがる選択では、Outliner順で最初の選択Objectを代表フレームとして使います。
- トポロジー確定後は対象メッシュ内の要素IDを再構築します。Loop Cut、Extrude、Bevelは生成要素へ選択を引き継ぎ、その他の再構築操作は選択を解除します。Undoでは元のIDと選択を復元します。
- 面生成は、同一オブジェクトの境界上にある3個以上の頂点を順番に選択する基本版です。
- GLB読込は静的な三角形メッシュが対象です。マテリアル、テクスチャ、スキン、アニメーションは取り込みません。
- STLは単位メタデータを持たないため、ミリメートルとして扱います。
- 自動E2Eの対象はChromiumです。Firefox / SafariはWebGL 2手動確認対象です。
