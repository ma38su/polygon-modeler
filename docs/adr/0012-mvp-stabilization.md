# ADR 0012: MVP安定化基準

## 状態

採用

## 決定

Production buildの主要フローをChromium E2Eで継続検証し、ブラウザ差異はWebGL 2フォールバックをFirefox / Safariの手動スモークテスト項目とする。大規模メッシュのCI基準は10,000頂点・9,801面の構築、検証、複製、保存復元を2.5秒以内とする。

Reactの予期しない例外はEditorErrorBoundaryで隔離し、復旧画面を表示すると同時に現在DocumentをIndexedDBへ退避する。DirtyなDocumentはデバウンス保存に加え、ページ離脱とバックグラウンド移行時にも保存を要求する。

リソース寿命はViewportが所有し、破棄時にGPU、Geometry、Material、Controls、Observer、イベント、AnimationFrameを解放する。

## 理由

非決定的なGC量をCIの合否へ直接使わず、再現可能な性能予算と明示的な解放契約を組み合わせるため。クラッシュがUI層に限定されてもEditor Coreの作業内容を復元可能にするため。
