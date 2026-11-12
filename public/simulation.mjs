// Teaching transport only. The frozen network instrument does not import this file.
export function simulateOffer(mode, {signal} = {}) {
  if (!['normal', 'fail', 'hang'].includes(mode)) throw new TypeError('Unknown offer mode');
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (callback, value) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => finish(reject, new DOMException('Attempt cancelled', 'AbortError'));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, {once: true});
    if (mode === 'normal') timer = setTimeout(() => finish(resolve, {message: 'Available · simulated offer'}), 600);
    if (mode === 'fail') timer = setTimeout(() => finish(reject, new Error('Simulated service failure')), 0);
    // Hang deliberately stays pending until Start again, a scenario change or page exit.
  });
}
