/*!
 * 嘘電卓 (uso-dentaku)
 * 押すと「嘘の答え」が出る電卓。入力中はふつう、= で大嘘。
 * モード: おまかせ / ポジティブ / 数字だけ嘘
 *
 * ロジックは DOM 非依存。ブラウザでは window.UsoDentaku、Node では module.exports で公開。
 */
(function (global) {
  'use strict';

  var MODES = ['auto', 'positive', 'numbers'];
  var SITE = 'https://shodai4.com/uso-dentaku/';
  var MAX_DIGITS = 12;

  /* ------------------------------------------------------------ utilities */

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function round10(v) {
    return Math.round(v * 1e10) / 1e10;
  }

  /** 数値 → 電卓風の文字列（桁区切り・小数は最大8桁で末尾0を落とす） */
  function fmtNumber(n) {
    if (typeof n !== 'number' || !isFinite(n)) return n > 0 ? '∞' : (n < 0 ? '-∞' : '0');
    var r = round10(n);
    var neg = r < 0;
    var abs = Math.abs(r);
    var s;
    if (Number.isInteger(abs)) {
      s = String(abs);
    } else {
      s = abs.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    }
    if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) {
      s = String(abs);
      if (s.indexOf('e') >= 0) return (neg ? '-' : '') + '999,999,999';
    }
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  /** 入力中の文字列 → 表示用（"1234." → "1,234." のように桁区切りだけ足す） */
  function fmtEntry(str) {
    if (str === null || str === undefined || str === '') return '0';
    var s = String(str);
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var hasDot = s.indexOf('.') >= 0;
    var parts = s.split('.');
    var head = parts[0] || '0';
    head = head.replace(/^0+(?=\d)/, '');
    if (head === '') head = '0';
    head = head.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = head + (hasDot ? '.' + (parts[1] || '') : '');
    return (neg ? '-' : '') + out;
  }

  /** 入力中の文字列 → 数値 */
  function parseEntry(str) {
    if (str === null || str === undefined) return 0;
    var s = String(str);
    if (s === '' || s === '-' || s === '.' || s === '-.') return 0;
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    var v = Number(s);
    return isFinite(v) ? v : 0;
  }

  function digitsOf(str) {
    return String(str === null || str === undefined ? '' : str).replace(/[^0-9]/g, '');
  }

  function digitCount(str) {
    return digitsOf(str).length;
  }

  function isWide(ch) {
    return /[\u1100-\u115f\u2e80-\u303e\u3040-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60]/.test(ch);
  }

  function apply(a, b, op) {
    switch (op) {
      case '+': return round10(a + b);
      case '−': return round10(a - b);
      case '×': return round10(a * b);
      case '÷': return b === 0 ? (a === 0 ? NaN : (a > 0 ? Infinity : -Infinity)) : round10(a / b);
      default: return b;
    }
  }

  function r(min, max) { return randInt(min, max); }

  /* -------------------------------------------------------- 嘘のカタログ */

  // おまかせ（雑・人間味・脱線。1本1本が独立した嘘）
  var AUTO_LINES = [
    function () { return '知らんけど ' + r(1, 20); },
    function () { return '計算めんどいから ' + r(0, 9); },
    function () { return 'だいたい ' + r(1, 99); },
    function () { return 'たぶん正解'; },
    function () { return '約' + r(10, 999) + '（気持ち）'; },
    function () { return '実質0円'; },
    function () { return '優勝！'; },
    function () { return '無限大∞'; },
    function () { return '今日はこれでOK'; },
    function () { return 'むしろプラス！'; },
    function () { return '気にするな！'; },
    function () { return '運気上昇 +999%'; },
    function () { return '明日の自分に任せよう'; },
    function () { return '999,999,999'; },
    function () { return '-0.0001'; },
    function () { return '40,000,000,000'; },
    function () { return '123,456,789'; },
    function () { return '答えは風の中'; },
    function () { return '電卓「知らん」'; },
    function () { return 'AIに聞いて'; },
    function () { return 'それ、ググって'; },
    function () { return '1+1は2とは限らない'; },
    function () { return '心の目で見ると ' + r(1, 99); },
    function () { return 'え、' + r(2, 99) + 'じゃない？'; },
    function () { return r(1, 99) + '円の価値あり'; },
    function () { return '誤差の範囲（誤差±' + r(1, 99) + '）'; },
    function () { return 'だいたい' + r(1, 9) + 'くらい'; },
    function () { return r(1, 99) + '…ってことで'; },
    function () { return 'うーん、' + r(1, 99); },
    function () { return r(1, 99) + '（自信なし）'; },
    function () { return r(1, 99) + 'です！（たぶん）'; },
    function () { return r(1, 99) + 'かも'; },
    function () { return 'だいたい倍の ' + r(2, 198); },
    function () { return '半分くらいの ' + r(1, 50); },
    function () { return '気合いで ' + r(1, 99); },
    function () { return '2（それ以上は野暮）'; },
    function () { return '1（十分でしょ）'; },
    function () { return '100万ドル'; },
    function () { return '無量大数'; },
    function () { return r(1, 99) + '兆円'; },
    function () { return 'なし！'; },
    function () { return 'あり！'; },
    function () { return 'それな'; },
    function () { return 'それっぽい数字で ' + r(10, 999); },
    function () { return 'ここはひとつ ' + r(1, 99) + ' で'; },
    function () { return r(1, 99) + '（異論は認める）'; },
    function () { return r(1, 99) + '（異論は認めない）'; },
    function () { return r(1, 99) + '（反論禁止）'; },
    function () { return 'だいたい' + r(1, 99) + '万'; },
    function () { return r(1, 99) + 'くらい？'; },
    function () { return r(1, 99) + 'でしょ、たぶん'; },
    function () { return 'ちょっと待って… ' + r(1, 99); },
    function () { return '計算機「' + r(1, 99) + '」'; },
    function () { return r(1, 99) + '！（ドヤ）'; },
    function () { return r(1, 9) + '（小声）'; },
    function () { return r(1, 99) + ' …知らんけどな'; },
    function () { return 'だいたい' + r(1, 99) + '。以上。'; },
    function () { return r(1, 99) + 'です。はい。'; },
    function () { return r(1, 99) + ' って書いときます'; },
    function () { return 'だいたい' + r(1, 99) + '。異論は認めん'; },
    function () { return '3.141592…'; },
    function () { return '√2（無理やり）'; },
    function () { return '-' + r(1, 99) + '（マイナスじゃない、投資）'; },
    function () { return r(1, 99) + '歳'; },
    function () { return r(1, 9) + '割'; },
    function () { return '全部で3つ'; },
    function () { return r(1, 99) + '（端数はサービス）'; },
    function () { return '0.0000…1（気持ち）'; },
    function () { return '宇宙の真理：' + r(1, 9); },
    function () { return '半額クーポン適用で ' + r(1, 99); }
  ];

  // ポジティブ（全肯定だけ）
  var POSITIVE_LINES = [
    function () { return '実質0円'; },
    function () { return 'むしろプラス！'; },
    function () { return '今日のあなたなら余裕'; },
    function () { return '気にするな！'; },
    function () { return '運気上昇 +999%'; },
    function () { return '明日の自分に任せよう'; },
    function () { return 'これは投資！ +∞'; },
    function () { return '貯金できた気分'; },
    function () { return '払った分だけ徳を積んだ'; },
    function () { return '人生の答えは ∞'; },
    function () { return 'むしろお得！'; },
    function () { return 'あなたなら大丈夫'; },
    function () { return '今日はもう十分がんばった'; },
    function () { return '心の余裕 +100'; },
    function () { return '笑顔が増えた分プラス'; },
    function () { return 'それ、ぜんぶ経験値'; },
    function () { return '未来の自分が喜んでる'; },
    function () { return '損失ゼロ（精神的に）'; },
    function () { return '安心してください、増えてます'; },
    function () { return 'いい流れ来てる'; },
    function () { return 'これで今日は勝ち'; },
    function () { return 'だいたいプラス'; },
    function () { return '+' + r(1, 999) + ' の幸せ'; },
    function () { return '0円になった！ラッキー'; },
    function () { return '出費じゃなくて先行投資'; },
    function () { return 'あなたの価値は ∞'; },
    function () { return '運気 +' + r(10, 999) + '%'; },
    function () { return '大丈夫、なんとかなる'; },
    function () { return 'この出会いに感謝'; },
    function () { return '今日も最高'; },
    function () { return '無限の可能性！'; },
    function () { return '全部チャラでいいよ'; },
    function () { return 'その分いいことが返ってくる'; },
    function () { return 'よくがんばりました！'; }
  ];

  /* ------------------------------------------------------- 文脈つきの嘘 */

  function specialLies(expr) {
    var out = [];
    var dg = expr.digits || '';

    if (expr.op === '÷' && expr.b === 0) {
      out = out.concat([
        '宇宙誕生',
        '0で割ると時空が歪む',
        'ここから先は神の領域',
        '無限ループ（抜け出せない）',
        '世界の終わり'
      ]);
      return out;
    }
    if (dg.indexOf('777') >= 0) {
      out = out.concat(['大当たり！', 'ラッキーセブン', '777…揃った！', 'ストライク！']);
    }
    if (dg.indexOf('1192') >= 0) {
      out = out.concat(['いい国つくろう', '1192（いい国つくろう）']);
    }
    if (dg.indexOf('4649') >= 0) {
      out = out.concat(['よろしく', 'よろしくお願いします！']);
    }
    if (dg.indexOf('4829') >= 0) {
      out = out.concat(['柴犬', 'ワン！']);
    }
    if (expr.trueResult === 0) {
      out = out.concat(['無', 'すべては無に帰した', '0（ゼロ）…つまり無']);
    }
    if (expr.op === '−' && expr.a !== null && expr.a > 0 && expr.b > 0 && expr.trueResult < 0) {
      out = out.concat(['借金じゃない、先行投資', 'マイナスは成長の証', '赤字（気持ちは黒字）']);
    }
    return out;
  }

  function autoLie(expr) {
    var sp;
    if (Math.random() < 0.72) {
      sp = specialLies(expr);
      if (sp && sp.length) return pick(sp);
    }
    return pick(AUTO_LINES)();
  }

  function positiveLie(expr) {
    if (expr.op === '÷' && expr.b === 0) {
      return pick(['無限の可能性！', '人生の答えは ∞', 'ここから無限に伸びる']);
    }
    if (expr.op === '−' && expr.trueResult < 0) {
      return pick(['実質0円', 'むしろプラス！', '出費じゃなくて先行投資', 'これは投資！ +∞']);
    }
    return pick(POSITIVE_LINES)();
  }

  // 数字だけ嘘（数字フォーマットのみ・文字なし）
  function numericLie(expr) {
    var t = expr.trueResult;
    var cands = [];

    var cd = concatDigits(expr);
    if (cd !== null) cands.push(Number(cd));

    if (typeof t === 'number' && isFinite(t)) {
      cands.push(t + randInt(1, 9));
      cands.push(t - randInt(1, 9));
      cands.push(t + 3);
      cands.push(t + 100);
      cands.push(t * 10);
      cands.push(t * 100);
      cands.push(t * 1000);
      cands.push(round10(t / 10));
      cands.push(round10(t / 100));
      cands.push(round10(t * 1.5));
      cands.push(round10(-t));
      cands.push(round10(t + 0.5));
      cands.push(round10(t * 1.1));
    }

    cands.push(999999999, 50000, -0.0001, 123456789, 1000000, -7, 42, 0, 3000000);

    var trueText = fmtNumber(t);
    var valid = [];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (typeof c !== 'number' || !isFinite(c)) continue;
      if (Math.abs(c) > 1e15) continue;
      var s = fmtNumber(c);
      if (s === trueText) continue;
      if (!/^-?[\d,]+(\.\d+)?$/.test(s)) continue;
      valid.push(s);
    }
    return valid.length ? pick(valid) : fmtNumber(t + 1);
  }

  function concatDigits(expr) {
    var a = digitsOf(expr.aText);
    var b = digitsOf(expr.bText);
    var s = expr.op ? a + b : b;
    if (!s) return null;
    s = s.replace(/^0+/, '') || '0';
    if (s.length > 10) return null;
    return s;
  }

  function makeLie(expr, mode, avoid) {
    var out = null;
    for (var i = 0; i < 30; i++) {
      if (mode === 'numbers') out = numericLie(expr);
      else if (mode === 'positive') out = positiveLie(expr);
      else out = autoLie(expr);
      if (typeof out === 'string' && out.length && out !== avoid) break;
    }
    if (typeof out !== 'string' || !out.length) {
      out = mode === 'numbers' ? '0' : '知らんけど';
    }
    if (avoid && out === avoid) {
      out = mode === 'numbers'
        ? fmtNumber(Math.abs(parseEntrySafe(out)) + 7)
        : pick(['知らんけど ' + r(1, 99), 'だいたい ' + r(1, 99), 'たぶん正解']);
    }
    return out;
  }

  function parseEntrySafe(s) {
    var v = Number(String(s).replace(/[^0-9.\-]/g, ''));
    return isFinite(v) ? v : 0;
  }

  /* --------------------------------------------------------------- state */

  function createState(mode) {
    return {
      mode: MODES.indexOf(mode) >= 0 ? mode : 'auto',
      entry: '0',
      acc: null,          // { value, text }
      op: null,
      freshEntry: false,  // 演算子直後 / = 直後で次の数字入力から始める
      justEvaluated: false,
      exprShown: '',
      result: null,
      lastExpr: null,
      lastLie: null
    };
  }

  function resetCalc(s) {
    s.entry = '0';
    s.acc = null;
    s.op = null;
    s.freshEntry = false;
    s.justEvaluated = false;
    s.exprShown = '';
    s.result = null;
    s.lastExpr = null;
  }

  function inputDigit(s, d) {
    if (s.justEvaluated) resetCalc(s);
    if (s.freshEntry) {
      s.entry = d;
      s.freshEntry = false;
    } else if (s.entry === '0') {
      s.entry = d;
    } else if (s.entry === '-0') {
      s.entry = '-' + d;
    } else if (digitCount(s.entry) < MAX_DIGITS) {
      s.entry += d;
    }
    s.result = null;
    s.exprShown = s.op && s.acc ? s.acc.text + ' ' + s.op + ' ' + fmtEntry(s.entry) : '';
  }

  function inputDot(s) {
    if (s.justEvaluated) resetCalc(s);
    if (s.freshEntry) {
      s.entry = '0.';
      s.freshEntry = false;
    } else if (s.entry.indexOf('.') < 0) {
      s.entry = (s.entry === '' ? '0' : s.entry) + '.';
    }
    s.result = null;
    s.exprShown = s.op && s.acc ? s.acc.text + ' ' + s.op + ' ' + fmtEntry(s.entry) : '';
  }

  function backspace(s) {
    if (s.justEvaluated) { resetCalc(s); return; }
    if (s.freshEntry) return;
    var e = s.entry.slice(0, -1);
    if (e === '' || e === '-' || e === '-0') e = '0';
    s.entry = e;
    s.result = null;
    s.exprShown = s.op && s.acc ? s.acc.text + ' ' + s.op + ' ' + fmtEntry(s.entry) : '';
  }

  function percent(s) {
    if (s.justEvaluated) resetCalc(s);
    var v = parseEntry(s.entry) / 100;
    s.entry = String(round10(v));
    s.freshEntry = false;
    s.result = null;
    s.exprShown = s.op && s.acc ? s.acc.text + ' ' + s.op + ' ' + fmtEntry(s.entry) : '';
  }

  function toggleSign(s) {
    if (s.justEvaluated) resetCalc(s);
    if (s.entry === '' || s.entry === '0') return;
    if (s.entry.charAt(0) === '-') s.entry = s.entry.slice(1);
    else s.entry = '-' + s.entry;
    s.result = null;
    s.exprShown = s.op && s.acc ? s.acc.text + ' ' + s.op + ' ' + fmtEntry(s.entry) : '';
  }

  function setOperator(s, op) {
    if (s.justEvaluated) {
      // = のあと演算子 → 新しい式を始める（嘘が数字ならそれを引き継ぐ）
      var seed = parseEntrySafe(s.result);
      var seedText = s.result;
      resetCalc(s);
      s.acc = { value: seed, text: /^-?[\d,]+(\.\d+)?$/.test(seedText) ? seedText : fmtNumber(seed) };
      s.op = op;
      s.freshEntry = true;
      s.exprShown = s.acc.text + ' ' + op;
      return;
    }
    if (s.op && s.acc && !s.freshEntry) {
      var b = parseEntry(s.entry);
      var v = apply(s.acc.value, b, s.op);
      s.acc = { value: v, text: fmtNumber(v) };
    } else if (!s.acc) {
      s.acc = { value: parseEntry(s.entry), text: fmtEntry(s.entry) };
    }
    s.op = op;
    s.freshEntry = true;
    s.result = null;
    s.exprShown = s.acc.text + ' ' + op;
  }

  function evaluate(s) {
    if (s.justEvaluated && s.lastExpr) {
      // 連続 = → 同じ式で別の嘘を出す
      s.result = makeLie(s.lastExpr, s.mode, s.lastLie);
      s.lastLie = s.result;
      s.exprShown = s.lastExpr.shown + ' =';
      return s;
    }

    var expr;
    if (s.op && s.acc) {
      var bText = s.freshEntry ? fmtNumber(s.acc.value) : fmtEntry(s.entry);
      var b = s.freshEntry ? s.acc.value : parseEntry(s.entry);
      expr = {
        a: s.acc.value,
        b: b,
        op: s.op,
        aText: s.acc.text,
        bText: bText,
        trueResult: apply(s.acc.value, b, s.op)
      };
    } else {
      var v = parseEntry(s.entry);
      expr = { a: null, b: v, op: null, aText: '', bText: fmtEntry(s.entry), trueResult: v };
    }

    expr.shown = expr.op ? expr.aText + ' ' + expr.op + ' ' + expr.bText : expr.bText;
    expr.digits = (digitsOf(expr.aText) + digitsOf(expr.bText)) || digitsOf(expr.bText);

    s.lastExpr = expr;
    s.result = makeLie(expr, s.mode, null);
    s.lastLie = s.result;
    s.exprShown = expr.shown + ' =';
    s.justEvaluated = true;
    s.freshEntry = true;
    s.acc = null;
    s.op = null;
    return s;
  }

  function press(s, key) {
    if (key === 'AC') {
      var m = s.mode;
      var fresh = createState(m);
      for (var k in fresh) if (Object.prototype.hasOwnProperty.call(fresh, k)) s[k] = fresh[k];
      return s;
    }
    if (/^[0-9]$/.test(key)) { inputDigit(s, key); return s; }
    switch (key) {
      case '.': inputDot(s); break;
      case '⌫': case 'Backspace': backspace(s); break;
      case '%': percent(s); break;
      case '+/-': case '±': toggleSign(s); break;
      case '+': case '−': case '-': case '×': case '*': case '÷': case '/':
        setOperator(s, key === '-' ? '−' : key === '*' ? '×' : key === '/' ? '÷' : key);
        break;
      case '=': evaluate(s); break;
      default: break;
    }
    return s;
  }

  function setMode(s, mode) {
    if (MODES.indexOf(mode) < 0) return s;
    s.mode = mode;
    if (s.justEvaluated && s.lastExpr) {
      // モードを切り替えたら、同じ式で出し直す
      s.result = makeLie(s.lastExpr, mode, s.lastLie);
      s.lastLie = s.result;
    }
    return s;
  }

  function displayResult(s) {
    return s.result !== null ? s.result : fmtEntry(s.entry);
  }

  /* ----------------------------------------------------------------- api */

  var api = {
    MODES: MODES,
    SITE: SITE,
    AUTO_LINES: AUTO_LINES,
    POSITIVE_LINES: POSITIVE_LINES,
    createState: createState,
    press: press,
    setMode: setMode,
    evaluate: evaluate,
    makeLie: makeLie,
    numericLie: numericLie,
    autoLie: autoLie,
    positiveLie: positiveLie,
    displayResult: displayResult,
    fmtNumber: fmtNumber,
    fmtEntry: fmtEntry,
    parseEntry: parseEntry,
    apply: apply
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.UsoDentaku = api;

  /* ------------------------------------------------------------- browser */

  if (typeof document === 'undefined') return;

  function boot() {
    var $ = function (id) { return document.getElementById(id); };
    var els = {
      app: $('app'),
      keys: $('keys'),
      screen: $('screen'),
      expr: $('expr'),
      result: $('result'),
      share: $('share'),
      copy: $('copyBtn'),
      tweet: $('tweetBtn'),
      toast: $('toast'),
      chips: Array.prototype.slice.call(document.querySelectorAll('.chip'))
    };
    if (!els.keys) return;

    var state = api.createState('auto');
    var toastTimer = null;

    function shareText() {
      var expr = state.lastExpr ? state.lastExpr.shown : '';
      var body = (expr ? expr + ' = ' : '') + displayResult(state);
      return '「' + body + '」だって。 #嘘電卓';
    }

    function fitKeys() {
      var w = els.keys.clientWidth;
      var h = els.keys.clientHeight;
      if (!w || !h) return;
      var gap = w < 360 ? 8 : 10;
      var size = Math.min((w - gap * 3) / 4, (h - gap * 4) / 5);
      size = Math.max(44, Math.min(size, 96));
      size = Math.floor(size);
      els.keys.style.setProperty('--key', size + 'px');
      els.keys.style.setProperty('--gap', gap + 'px');
    }

    function fitResult() {
      var text = displayResult(state);
      var boxW = els.screen.clientWidth - 8;
      var weight = 0;
      for (var i = 0; i < text.length; i++) weight += isWide(text.charAt(i)) ? 1 : 0.56;
      if (weight <= 0) weight = 1;
      var size = boxW / weight * 0.97;
      var maxH = Math.max(46, Math.round(window.innerHeight * 0.3));
      size = Math.min(size, 54);
      // 2行に収まる範囲で少し大きくしてもよいが、基本は1行に収める
      if (size < 20) size = 20;
      size = Math.max(16, Math.min(size, 54));
      els.result.style.fontSize = size.toFixed(1) + 'px';
      els.result.style.maxHeight = maxH + 'px';
    }

    function render() {
      var text = displayResult(state);
      els.result.textContent = text;
      els.expr.textContent = state.exprShown || '';
      els.expr.title = state.exprShown || '';
      var show = state.result !== null;
      els.share.hidden = !show;
      if (show) {
        var t = shareText();
        els.tweet.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) +
          '&url=' + encodeURIComponent(SITE);
        els.tweet.setAttribute('aria-label', 'Xでポスト: ' + t);
      }
      fitResult();
    }

    function flash(el) {
      if (!el) return;
      el.classList.add('is-pressed');
      window.setTimeout(function () { el.classList.remove('is-pressed'); }, 90);
    }

    function toast(msg) {
      if (!els.toast) return;
      els.toast.textContent = msg;
      els.toast.classList.add('is-on');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        els.toast.classList.remove('is-on');
      }, 1400);
    }

    function tapKey(key, el) {
      if (key === 'AC') {
        api.press(state, 'AC');
        render();
        flash(el);
        return;
      }
      api.press(state, key);
      render();
      flash(el);
      if (key === '=' && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(8); } catch (e) { /* noop */ }
      }
    }

    els.keys.addEventListener('pointerdown', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.key') : null;
      if (!btn) return;
      ev.preventDefault();
      tapKey(btn.getAttribute('data-key'), btn);
    });

    // 古い環境向けフォールバック（pointerdown が無い場合のみ）
    els.keys.addEventListener('click', function (ev) {
      if (window.PointerEvent) return;
      var btn = ev.target.closest ? ev.target.closest('.key') : null;
      if (!btn) return;
      tapKey(btn.getAttribute('data-key'), btn);
    });

    els.chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var mode = chip.getAttribute('data-mode');
        api.setMode(state, mode);
        els.chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        render();
      });
    });

    function copyResult() {
      var text = shareText() + ' ' + SITE;
      var done = function () { toast('コピーしました'); };
      var fail = function () { toast('コピーできませんでした'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          legacyCopy(text) ? done() : fail();
        });
      } else {
        legacyCopy(text) ? done() : fail();
      }
    }

    function legacyCopy(text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }

    if (els.copy) els.copy.addEventListener('click', copyResult);

    // 物理キーボードでも触れるように（PCで試すとき用）
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var k = ev.key;
      if (/^[0-9]$/.test(k)) { tapKey(k, null); ev.preventDefault(); return; }
      if (k === '.') { tapKey('.', null); ev.preventDefault(); return; }
      if (k === '+') { tapKey('+', null); ev.preventDefault(); return; }
      if (k === '-') { tapKey('−', null); ev.preventDefault(); return; }
      if (k === '*') { tapKey('×', null); ev.preventDefault(); return; }
      if (k === '/') { tapKey('÷', null); ev.preventDefault(); return; }
      if (k === '%') { tapKey('%', null); ev.preventDefault(); return; }
      if (k === 'Enter' || k === '=') { tapKey('=', null); ev.preventDefault(); return; }
      if (k === 'Backspace') { tapKey('⌫', null); ev.preventDefault(); return; }
      if (k === 'Escape' || k === 'Delete') { tapKey('AC', null); ev.preventDefault(); return; }
    });

    window.addEventListener('resize', function () { fitKeys(); fitResult(); });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () { fitKeys(); fitResult(); }, 120);
    });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { fitKeys(); }).observe(els.keys);
    }

    fitKeys();
    render();
    window.setTimeout(function () { fitKeys(); fitResult(); }, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
