/* つくったもの：代表の3本だけ見せて、残りは「もっと見る」で開く */
(function () {
  var list = document.getElementById('app-list');
  var wrap = document.getElementById('app-more');
  var btn = document.getElementById('app-more-btn');
  if (!list || !wrap || !btn) return;

  var extra = list.querySelectorAll('.app-card--extra');
  if (!extra.length) return; // 折りたたむ分がなければボタンは出さない

  var total = list.querySelectorAll('.app-card').length;
  var label = btn.querySelector('.app-more-label') || btn;

  function setOpen(open) {
    if (open) {
      list.classList.remove('is-collapsed');
    } else {
      list.classList.add('is-collapsed');
    }
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    label.textContent = open ? 'たたむ' : 'もっと見る（全' + total + '件）';
    wrap.classList.toggle('is-open', open);
  }

  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    setOpen(!open);
    if (open) {
      // たたむとボタンが上にずれるので、押した位置から見失わないようにする
      requestAnimationFrame(function () {
        var header = document.querySelector('.site-header');
        var offset = (header ? header.getBoundingClientRect().height : 0) + 16;
        var rect = btn.getBoundingClientRect();
        if (rect.top < offset || rect.bottom > window.innerHeight) {
          var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({
            top: window.scrollY + rect.top - offset,
            behavior: smooth ? 'smooth' : 'auto'
          });
        }
      });
    }
  });

  setOpen(false);
  wrap.hidden = false;
})();
