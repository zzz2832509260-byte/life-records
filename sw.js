/* Service Worker —— 让应用能装到桌面、断网也能打开。
 *
 * 两条铁律：
 *   1. 只处理同源请求。api.github.com / gitee.com 这些同步接口一律放行，
 *      绝不能缓存 —— 缓存了就会读到旧数据，那是灾难。
 *   2. 页面本体用"网络优先"，静态资源用"缓存优先"。
 *      这样你在电脑上改了应用重新部署，手机下次打开就能拿到新版，
 *      而不是被旧缓存永远锁住。
 *
 * 改了应用代码要发布时：把 VERSION 加一，旧缓存会在 activate 时被清掉。
 */
const VERSION = 'v1';
const CACHE = 'life-records-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})            /* 个别文件缺失不该让整个安装失败 */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  /* 非 GET（同步用的 POST/PATCH）直接放行 */
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* 跨域一律不碰 —— 尤其是同步接口 */
  if (url.origin !== self.location.origin) return;

  /* 页面本体：网络优先，拿到新版就更新缓存；断网时用缓存兜底 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html')
          .then(r => r || caches.match('./'))
          .then(r => r || new Response(
            '<!doctype html><meta charset="utf-8"><title>离线</title>' +
            '<div style="font:16px/1.8 system-ui;padding:40px;text-align:center">' +
            '应用还没缓存好，请联网打开一次再离线使用。</div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )))
    );
    return;
  }

  /* 静态资源：缓存优先，没有就联网取回来顺手存下 */
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
