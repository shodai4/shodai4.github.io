/* 日めくりカレンダー：年月をえらぶと LINE STORE の直リンクを出す */
(function () {
  var D = window.DAYMEGURI;
  if (!D) return;

  var yearSel = document.getElementById('dm-year');
  var monthSel = document.getElementById('dm-month');
  var form = document.getElementById('dm-form');
  var out = document.getElementById('dm-result');
  var nowBtn = document.getElementById('dm-now');
  if (!yearSel || !monthSel || !out) return;

  var minY = D.range.from;
  var maxY = D.range.to;
  var today = new Date();
  var curY = today.getFullYear();
  var curM = today.getMonth() + 1;

  var y;
  for (y = minY; y <= maxY; y++) {
    var oy = document.createElement('option');
    oy.value = String(y);
    oy.textContent = y + '年';
    yearSel.appendChild(oy);
  }
  for (var m = 1; m <= 12; m++) {
    var om = document.createElement('option');
    om.value = String(m);
    om.textContent = m + '月';
    monthSel.appendChild(om);
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function render(yy, mm, remember) {
    yy = clamp(yy, minY, maxY);
    mm = clamp(mm, 1, 12);
    yearSel.value = String(yy);
    monthSel.value = String(mm);

    var row = D.months[String(yy)] || [];
    var id = row[mm - 1] || null;
    var label = yy + '年' + mm + '月';

    if (!id) {
      var q = encodeURIComponent(label + 'の日めくりカレンダー');
      out.innerHTML =
        '<div class="dm-card dm-card--empty">' +
          '<p class="dm-card-title">' + label + 'のカレンダーを、<wbr>LINE STORE でどうぞ。</p>' +
          '<p class="dm-card-meta">下のボタンから LINE STORE で「' + label + '」を探せます。クリエイターのページからも、すべてのスタンプをご覧いただけます。</p>' +
          '<div class="dm-card-actions">' +
            '<a class="btn" href="https://store.line.me/search/ja?q=' + q + '" target="_blank" rel="noopener">LINE STORE で「' + label + '」を見る</a>' +
            '<a class="btn" href="' + D.author.storeUrl + '" target="_blank" rel="noopener">クリエイターのページへ</a>' +
          '</div>' +
        '</div>';
    } else {
      var url = D.productUrlTemplate.replace('{id}', id);
      var img = D.thumbUrlTemplate.replace('{id}', id);
      out.innerHTML =
        '<div class="dm-card">' +
          '<div class="dm-card-thumb">' +
            '<img src="' + img + '" alt="' + label + 'の日めくりカレンダーの見本" width="240" height="240" loading="lazy">' +
          '</div>' +
          '<div class="dm-card-body">' +
            '<p class="dm-card-title">' + label + 'の<wbr>日めくりカレンダーです。</p>' +
            '<p class="dm-card-meta">LINEスタンプ ／ 1セット ¥190〜 ／ LINEスタンプ プレミアム対象</p>' +
            '<p class="dm-url-label">このスタンプのURL</p>' +
            '<p class="dm-url"><a href="' + url + '" target="_blank" rel="noopener">' + url + '</a></p>' +
            '<div class="dm-card-actions">' +
              '<a class="btn btn--primary" href="' + url + '" target="_blank" rel="noopener">LINE STORE で開く</a>' +
              '<button class="btn" type="button" data-copy="' + url + '">URLをコピー</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    if (remember) {
      try { history.replaceState(null, '', '#dm-' + yy + '-' + mm); } catch (e) {}
    }
  }

  function fromHash() {
    var h = (location.hash || '').match(/^#dm-(\d{4})-(\d{1,2})$/);
    if (!h) return null;
    return { y: parseInt(h[1], 10), m: parseInt(h[2], 10) };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    render(parseInt(yearSel.value, 10), parseInt(monthSel.value, 10), true);
    out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  yearSel.addEventListener('change', function () {
    render(parseInt(yearSel.value, 10), parseInt(monthSel.value, 10), true);
  });
  monthSel.addEventListener('change', function () {
    render(parseInt(yearSel.value, 10), parseInt(monthSel.value, 10), true);
  });

  if (nowBtn) {
    nowBtn.addEventListener('click', function () {
      render(curY, curM, true);
    });
  }

  out.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'コピーしました';
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      done();
    }
  });

  var init = fromHash();
  if (init) render(init.y, init.m, false);
  else render(curY, curM, false);
})();
