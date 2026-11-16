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
      // たたむとボタンが上にずれるので、つねに画面の上に残るようにする
      var header = document.querySelector('.site-header');
      var offset = (header ? header.getBoundingClientRect().height : 0) + 16;
      var rect = btn.getBoundingClientRect();
      if (rect.top < offset || rect.bottom > window.innerHeight) {
        window.scrollTo(0, window.scrollY + rect.top - offset);
      }
    }
  });

  setOpen(false);
  wrap.hidden = false;
})();
