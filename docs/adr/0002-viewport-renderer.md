# ADR 0002: Viewportレンダラーのライフサイクル

- Status: Accepted
- Date: 2026-08-16

## Decision

- ViewportのThree.jsオブジェクトと描画ループはReact stateに置かず、`Viewport`クラスが所有する。
- `?renderer=webgl2`または`?renderer=webgpu`で検証用にバックエンドを固定できる。指定がなければWebGPUを試し、初期化失敗時はWebGL 2へフォールバックする。
- WebGPU実装は動的importし、非対応環境の初期バンドルから分離する。
- WebGPU device lostとWebGL context lostでは編集状態へ触れず、エラーと再読み込み操作を表示する。自動再初期化はEditor Coreとの同期が実装された後に再検討する。
- mount時に生成したObserver、Controls、描画ループ、Renderer、Canvasはunmount時にすべて破棄する。

## Consequences

描画バックエンドの障害をViewport層内に閉じ込め、今後のEditor CoreはGPU状態から独立できる。バックエンド固定URLによりフォールバック経路を継続的にブラウザテストできる。
