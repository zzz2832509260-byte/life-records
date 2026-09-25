/* Service Worker —— 每日工作台（离线版）
 *
 * 这是**子目录里的第二个独立 PWA**，和站点根目录那个「我的记录表」互不干扰：
 *   · 它的作用域由脚本自身位置决定，就是 /<repo>/daily-desk/，越不出去；
 *   · 根目录那个 SW 只接管 /<repo>/ 和 /<repo>/index.html，也不会来抢这一页；
 *   · 两个应用各自一份缓存，装到桌面上是两个图标。
 *
 * 两条铁律和根目录那个一致：
 *   1. 跨域一律不碰（api.github.com / gitee.com 这些同步接口绝不能缓存）。
 *   2. 页面本体用"缓存优先 + 后台更新"，因为从国内访问 github.io 常首次超时。
 *
 * 改了 daily-desk 里的东西要发布时：把 VERSION 加一。
 */
const VERSION = 'desk-v1';
const CACHE = 'daily-desk-' + VERSION;

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

/* 作用域内的路径判定 —— 双保险。
   浏览器其实已经按 scope 拦住了越界请求，但这里再判一次：
   万一以后有人把 sw.js 挪到根目录，这行能防止它把两个应用搅在一起。 */
function inScope(url) {
  const base = new URL('./', self.location).pathname;
  return url.pathname === base || url.pathname.indexOf(base) === 0;
}

function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>离线</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:16px/1.9 system-ui,-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;' +
    'padding:56px 24px;text-align:center;color:#586074">' +
    '<div style="font-size:34px;margin-bottom:14px">🗂</div>' +
    '<b style="font-size:17px;color:#10131c">工作台还没缓存好</b><br>' +
    '这是第一次打开，需要联网一次。<br>连上网络后刷新即可。' +
    '</div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

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
        /* 只清自己这一套前缀，绝不能顺手把根目录那个应用的缓存删掉 */
        keys.filter(k => k.indexOf('daily-desk-') === 0 && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;                  /* 同步用的 POST/PATCH 放行 */

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin !== self.location.origin) return;    /* 跨域不碰 */
  if (!inScope(url)) return;                          /* 越界不管 */

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const fromNetwork = fetch(req)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
        if (cached) return cached;              /* 有缓存就秒开，不等网络 */
        return fromNetwork.then(res => res || offlinePage());
      })
    );
    return;
  }

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
