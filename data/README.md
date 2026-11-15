# 日めくりカレンダー データ（data/calendar.js）

`shodai4.com` の「日めくりカレンダー」セクションで使う、年月 → LINE STORE 商品IDの対応表です。

- 生成日: 2026-11-15
- 出どころ: LINE STORE の公開検索API（ログイン不要）
  `https://store.line.me/api/search/sticker?category=sticker&type=ALL&offset=0&limit=100&query=ヒモぴっぴ`
  （`Accept-Language: ja` で日本語タイトルを取得）
- 対象: クリエイター「ヒモぴっぴ」（authorId 20746）のスタンプのうち、タイトルが
  `YYYY年M月の日めくりカレンダーです。` のもの
- 範囲: 1900年1月〜2100年12月（全2,412か月）のうち **2,357種類**。欠けている55か月は `null`
  - 2044年3月〜2048年2月 の48か月（未制作）
  - 2010年6月 / 2032年2月 / 2060年10月 / 2078年12月 / 2081年7月 / 2091年10月 / 2094年8月（管理画面では「編集中」）
- 注意: サイト（`/stickers/`）の表示は「1900年1月〜2100年12月・全2,412種」で統一する方針（2026-11-15 本人指示）。
  データ上 `null` の月をえらんだときは、`js/daymeguri.js` が「LINE STORE で「YYYY年M月」を見る」を案内する。
  データを生成し直したときにこの差が埋まったら、この注意書きは消してよい。

## 形

```js
window.DAYMEGURI = {
  author: { name, nameEn, authorId, storeUrl },
  range: { from: 1900, to: 2100 },
  count: 2357,
  totalMonths: 2412,
  productUrlTemplate: "https://store.line.me/stickershop/product/{id}/ja",
  thumbUrlTemplate: "https://stickershop.line-scdn.net/stickershop/v1/product/{id}/LINEStorePC/main.png?v=1",
  months: { "1900": [ "27254849", ...12か月分 ], ... }   // 欠番は null
};
```

## 更新するとき

1. 上のAPIを `offset` を100ずつ進めて全件取り、タイトルから年月を抜き出す
2. `months` を作り直す（欠番は `null`）
3. 数件を `https://store.line.me/stickershop/product/{id}/ja` で開き、`og:title` が年月と合うか確認
4. このファイルの生成日と件数を更新
