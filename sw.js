/* Service Worker —— 让应用能装到桌面、断网也能打开。
 *
 * 两条铁律：
 *   1. 只处理同源请求。api.github.com / gitee.com 这些同步接口一律放行，
 *      绝不能缓存 —— 缓存了就会读到旧数据，那是灾难。
 *   2. 页面本体用"缓存优先 + 后台更新"（stale-while-revalidate）。
 *
 * 为什么页面不用"网络优先"：
 *   实测从国内访问 github.io 经常首次连接超时（ETIMEDOUT / ECONNRESET）。
 *   网络优先的话，每次打开 App 都要先等网络超时（可能十几秒）才回退到缓存，
 *   体验极差。改成缓存优先后是**秒开**，同时后台悄悄把新版拉下来，
 *   下次打开就是新版了 —— 对"内容很少变、网络不稳定"的场景这是最优解。
 *
 * 改了应用代码要发布时：把 VERSION 加一，旧缓存会在 activate 时被清掉。
 */
const VERSION = 'v6';
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

/* 第一次打开且网络不通时的兜底页面（这之后再打开就都走缓存了） */
function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>离线</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:16px/1.9 system-ui,-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;' +
    'padding:56px 24px;text-align:center;color:#586074">' +
    '<div style="font-size:34px;margin-bottom:14px">📓</div>' +
    '<b style="font-size:17px;color:#10131c">应用还没缓存好</b><br>' +
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

  /* 页面本体：缓存优先 + 后台更新（秒开，同时悄悄拉新版）
     没有缓存时才等网络 —— 也就是第一次打开的那一次。

     ⚠️ 只接管"本应用自己的那一页"。Service Worker 的作用域会覆盖子目录，
     如果无脑对所有导航都返回 ./index.html，同一个域名下放在子目录里的
     另一个应用就会被这个 SW 顶掉（打开子目录却显示了本应用）。 */
  if (req.mode === 'navigate') {
    var here = new URL('./', self.location).pathname;
    if (url.pathname !== here && url.pathname !== here + 'index.html') {
      return;                       /* 不是本应用的页面，交给浏览器正常处理 */
    }
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

        if (cached) return cached;          /* 有缓存：立刻返回，不等网络 */
        return fromNetwork.then(res => res || offlinePage());
      })
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
