export type OAuthWebViewState =
  | { embedded: false }
  | { embedded: true; instruction: string; browserLabel: string };

export function detectOAuthWebView(userAgent: string): OAuthWebViewState {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const inAppMarkers = [
    'fbav', 'fban', 'fb_iab', 'instagram', 'messenger', 'twitter',
    'linkedinapp', 'snapchat', 'discord', 'whatsapp', 'tiktok',
  ];
  const embedded = inAppMarkers.some((marker) => ua.includes(marker))
    || (isAndroid && (/; wv\)/.test(ua) || ua.includes(' version/4.0')))
    || (isIOS && ua.includes('applewebkit') && !ua.includes('safari/'));

  if (!embedded) return { embedded: false };
  return isIOS
    ? {
        embedded: true,
        browserLabel: 'Safari',
        instruction: 'Google and Discord sign-in may block embedded browsers. Open this page in Safari, then try signing in again.',
      }
    : {
        embedded: true,
        browserLabel: 'Chrome',
        instruction: 'Google and Discord sign-in may block embedded browsers. Open this page in Chrome, then try signing in again.',
      };
}
