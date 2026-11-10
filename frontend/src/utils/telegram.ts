export function openTelegramInAppUrl(url: string): void {
  if (!url) return;
  const webApp = (window as any).Telegram?.WebApp;
  if (webApp) {
    if ((url.includes('t.me/') || url.includes('telegram.me/')) && typeof webApp.openTelegramLink === 'function') {
      webApp.openTelegramLink(url);
      return;
    }
    if (typeof webApp.openLink === 'function') {
      webApp.openLink(url);
      return;
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
