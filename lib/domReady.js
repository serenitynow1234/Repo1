(function () {
  if (window.domReady) {
    return;
  }
  window.domReady = function domReady(callback) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      queueMicrotask(callback);
    } else {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    }
  };
})();
