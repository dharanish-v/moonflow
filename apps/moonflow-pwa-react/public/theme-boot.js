// theme-boot.js — runs synchronously in <head>, before the app bundle, so a
// forced Light/Dark theme is applied on first paint instead of flashing the
// other theme until IndexedDB has loaded (T73). The app mirrors its theme
// setting to localStorage (useResolvedTheme). A separate file, not an inline
// script: the CSP allows only same-origin scripts.
(function () {
  var mode = null;
  try {
    mode = localStorage.getItem('theme');
  } catch {
    // storage blocked: fall back to the OS preference
  }
  var light = mode === 'light' || (mode !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.toggle('light', light);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? '#F7F5EF' : '#14132B';
})();
