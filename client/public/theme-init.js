// Applied before first paint to avoid a flash of the wrong theme/direction.
(function () {
  try {
    var stored = localStorage.getItem('openlearn.theme');
    var dark =
      stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');

    var lang = localStorage.getItem('openlearn.language') || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#0b1f4b');
  } catch (error) {
    /* ignore */
  }
})();
