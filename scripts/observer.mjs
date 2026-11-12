// Injected by the runner, independent of application success messages and product category data.
export function installOracle(expected) {
  const state = window.verifier = {inputs: [], matches: [], firstCorrectDOM: null, firstCorrectOpportunity: null};
  const visibleProducts = () => [...document.querySelectorAll('#products > li')]
    .filter((item) => !item.hidden && getComputedStyle(item).display !== 'none' && getComputedStyle(item).visibility !== 'hidden' && item.getClientRects().length)
    .map((item) => ({id: item.getAttribute('data-id'), name: item.querySelector('h3')?.textContent.trim()}));
  state.read = visibleProducts;
  document.addEventListener('click', (event) => {
    const target = event.target.closest('button')?.id;
    if (target) state.inputs.push({target, timeStamp: event.timeStamp, capturedAt: performance.now(), trusted: event.isTrusted});
  }, true);
  const check = () => {
    if (!state.inputs.some((input) => input.target === 'shoes')) return;
    const actual = visibleProducts();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return;
    if (state.firstCorrectDOM === null) {
      state.firstCorrectDOM = performance.now();
      state.matches.push({at: state.firstCorrectDOM, products: actual});
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (JSON.stringify(visibleProducts()) === JSON.stringify(expected)) state.firstCorrectOpportunity = performance.now();
      }));
    }
  };
  new MutationObserver(check).observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
}
