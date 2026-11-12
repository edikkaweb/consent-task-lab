// Teaching-view observer. The measuring instrument in scripts/observer.mjs is unchanged.
export const WINDOW_MS = 1500;
export function readProducts(list) {
  return [...list.children]
    .filter(node => !node.hidden && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && node.getClientRects().length)
    .map(node => ({id: node.getAttribute('data-id'), name: node.querySelector('h3')?.textContent.trim()}));
}
export const matches = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
export function classify({firstMatch, inputAt, actual, expected, errorAt}) {
  if (Number.isFinite(firstMatch) && firstMatch >= inputAt && firstMatch - inputAt <= WINDOW_MS && matches(actual, expected)) return 'complete';
  return Number.isFinite(errorAt) && errorAt >= inputAt && errorAt - inputAt <= WINDOW_MS ? 'error' : 'incomplete';
}
export function observeProducts(list, onRead) {
  const observer = new MutationObserver(onRead);
  observer.observe(list, {subtree:true, childList:true, attributes:true, characterData:true});
  return () => observer.disconnect();
}
