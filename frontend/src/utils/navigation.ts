export function openExternalUrl(url: string): void {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
