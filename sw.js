// 太鼓フォームチェック：オフライン用の仕組み
// 新しい版を出すときは、index.html の APP_VERSION と、ここの VERSION を同じ値に上げる
const VERSION = '2026.09.26-4';
const APP_CACHE = 'taiko-app-' + VERSION;
const POSE_CACHE = 'taiko-pose-1';   // AIのファイル（約18MB）は版をまたいで使い回す
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const POSE = ['./pose.js', './pose_solution_packed_assets_loader.js', './pose_solution_packed_assets.data', './pose_web.binarypb',
  './pose_landmark_lite.tflite', './pose_solution_simd_wasm_bin.js', './pose_solution_simd_wasm_bin.wasm', './pose_solution_simd_wasm_bin.data',
  './pose_solution_wasm_bin.js', './pose_solution_wasm_bin.wasm'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    // cache:'reload' で必ずサーバーの最新を取る（古い版が混ざらないように）
    await app.addAll(CORE.map(u => new Request(u, {cache:'reload'})));
    const pose = await caches.open(POSE_CACHE);
    await Promise.all(POSE.map(async u => { if (!(await pose.match(u))) await pose.add(u).catch(() => null); }));
  })());
  // すぐには入れ替えず、画面側の合図（SKIP_WAITING）を待つ
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('taiko-app-') && k !== APP_CACHE || k.startsWith('taiko-form-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, {ignoreSearch: true});
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && POSE.some(u => req.url.endsWith(u.slice(1)))) (await caches.open(POSE_CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
