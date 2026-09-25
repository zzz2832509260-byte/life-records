/* Service Worker 鈥斺€?姣忔棩宸ヤ綔鍙帮紙绂荤嚎鐗堬級
 *
 * 杩欐槸**瀛愮洰褰曢噷鐨勭浜屼釜鐙珛 PWA**锛屽拰绔欑偣鏍圭洰褰曢偅涓€屾垜鐨勮褰曡〃銆嶄簰涓嶅共鎵帮細
 *   路 瀹冪殑浣滅敤鍩熺敱鑴氭湰鑷韩浣嶇疆鍐冲畾锛屽氨鏄?/<repo>/daily-desk/锛岃秺涓嶅嚭鍘伙紱
 *   路 鏍圭洰褰曢偅涓?SW 鍙帴绠?/<repo>/ 鍜?/<repo>/index.html锛屼篃涓嶄細鏉ユ姠杩欎竴椤碉紱
 *   路 涓や釜搴旂敤鍚勮嚜涓€浠界紦瀛橈紝瑁呭埌妗岄潰涓婃槸涓や釜鍥炬爣銆? *
 * 涓ゆ潯閾佸緥鍜屾牴鐩綍閭ｄ釜涓€鑷达細
 *   1. 璺ㄥ煙涓€寰嬩笉纰帮紙api.github.com / gitee.com 杩欎簺鍚屾鎺ュ彛缁濅笉鑳界紦瀛橈級銆? *   2. 椤甸潰鏈綋鐢?缂撳瓨浼樺厛 + 鍚庡彴鏇存柊"锛屽洜涓轰粠鍥藉唴璁块棶 github.io 甯搁娆¤秴鏃躲€? *
 * 鏀逛簡 daily-desk 閲岀殑涓滆タ瑕佸彂甯冩椂锛氭妸 VERSION 鍔犱竴銆? */
const VERSION = 'desk-v6';
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

/* 浣滅敤鍩熷唴鐨勮矾寰勫垽瀹?鈥斺€?鍙屼繚闄┿€?   娴忚鍣ㄥ叾瀹炲凡缁忔寜 scope 鎷︿綇浜嗚秺鐣岃姹傦紝浣嗚繖閲屽啀鍒や竴娆★細
   涓囦竴浠ュ悗鏈変汉鎶?sw.js 鎸埌鏍圭洰褰曪紝杩欒鑳介槻姝㈠畠鎶婁袱涓簲鐢ㄦ悈鍦ㄤ竴璧枫€?*/
function inScope(url) {
  const base = new URL('./', self.location).pathname;
  return url.pathname === base || url.pathname.indexOf(base) === 0;
}

function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>绂荤嚎</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:16px/1.9 system-ui,-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;' +
    'padding:56px 24px;text-align:center;color:#586074">' +
    '<div style="font-size:34px;margin-bottom:14px">馃梻</div>' +
    '<b style="font-size:17px;color:#10131c">宸ヤ綔鍙拌繕娌＄紦瀛樺ソ</b><br>' +
    '杩欐槸绗竴娆℃墦寮€锛岄渶瑕佽仈缃戜竴娆°€?br>杩炰笂缃戠粶鍚庡埛鏂板嵆鍙€? +
    '</div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})            /* 涓埆鏂囦欢缂哄け涓嶈璁╂暣涓畨瑁呭け璐?*/
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        /* 鍙竻鑷繁杩欎竴濂楀墠缂€锛岀粷涓嶈兘椤烘墜鎶婃牴鐩綍閭ｄ釜搴旂敤鐨勭紦瀛樺垹鎺?*/
        keys.filter(k => k.indexOf('daily-desk-') === 0 && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;                  /* 鍚屾鐢ㄧ殑 POST/PATCH 鏀捐 */

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin !== self.location.origin) return;    /* 璺ㄥ煙涓嶇 */
  if (!inScope(url)) return;                          /* 瓒婄晫涓嶇 */

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
        if (cached) return cached;              /* 鏈夌紦瀛樺氨绉掑紑锛屼笉绛夌綉缁?*/
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
