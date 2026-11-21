# shodai4.com — ポートフォリオ

`shodai4.com` で公開する個人サイト（静的HTML/CSS/JSのみ・ビルド不要）。
トップは「しょうだい（shodai4）の制作の置き場」で、前面に出すアプリは iOS / Web の **TERRITORY WALK** 1本。
その下の「つくったもの」には他のツールも並べ、代表3本だけ見せて残りは「もっと見る（全8件）」で開く。
絵の活動（アトリエ三月 年末展2026・ZINE・BASEショップ）も並べている。

## 中身

| ファイル | 役割 |
| --- | --- |
| `index.html` | トップページ（つくったもの／描いたもの／つくる人／つながる） |
| `apps/territory-walk/index.html` | TERRITORY WALK 専用の紹介ページ（`/apps/territory-walk/`） |
| `apps/art-supply-manager/index.html` | アトリコ専用の紹介ページ（`/apps/art-supply-manager/`） |
| `styles.css` | 全スタイル（外部フォント・CDNなし） |
| `js/apps-list.js` | トップの「つくったもの」の開閉（代表3本＋「もっと見る」） |
| `mine-othello/index.html` | 地雷オセロ（`/mine-othello/`・CPU対戦・CSS/JS内包の1ファイル） |
| `404.html` | 404ページ |
| `CNAME` | `shodai4.com`（GitHub Pages のカスタムドメイン） |
| `app-ads.txt` | AdMob 用（`pub-5739782559889389`）。`shodai4/territory-walk` の同ファイルと同一内容 |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け（トップと `/apps/territory-walk/`・`/apps/art-supply-manager/` を収録） |
| `.nojekyll` | Jekyll ビルドをスキップ |
| `assets/territory-walk.jpg` | TERRITORY WALK のスクリーンショット（1600px・約317KB） |
| `assets/art-supply-manager.jpg` | アトリコのスクリーンショット3枚組（2276×1160・約215KB） |
| `assets/og.jpg` | OGP/Twitterカード用（1200×630） |

## URLの分担（重要）

- `https://shodai4.com/` — このリポジトリ（`shodai4/shodai4.github.io`）
- `https://shodai4.com/apps/territory-walk/` — このリポジトリの紹介ページ
- `https://shodai4.com/apps/art-supply-manager/` — このリポジトリのアトリコ紹介ページ（LP）
- `https://shodai4.com/territory-walk/` — **別リポジトリ** `shodai4/territory-walk` の GitHub Pages（実際に遊ぶアプリ本体）
  - このリポジトリに `territory-walk/` フォルダを作ると競合するので作らない。紹介ページは必ず `apps/territory-walk/`。
- `https://apps.apple.com/jp/app/id6834676433` — App Store（テリトリーウォーク［歩いて陣取り］・無料／アプリ内購入）
- `https://shodai4.com/art-supply-manager/` — **別リポジトリ** `shodai4/art-supply-manager` の GitHub Pages（アトリコのアプリ本体）
  - このリポジトリに `art-supply-manager/` フォルダを作ると競合するので作らない。紹介ページは必ず `apps/art-supply-manager/`。

## 公開手順（GitHub Pages）

1. リポジトリ `shodai4/shodai4.github.io` を作成（Public・README等は追加しない）
2. `main` ブランチへこのフォルダの中身を push
3. Settings → Pages → Source: `Deploy from a branch` / Branch: `main` / `/ (root)` → Save
4. 同じ画面の Custom domain に `shodai4.com` を入れて Save（`CNAME` ファイルがあるので自動で入る）
5. DNS チェックが通ったら **Enforce HTTPS** にチェック

## DNS（XServerドメイン側・設定済み 2026-11-15）

- A `shodai4.com` → 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153
- CNAME `www` → `shodai4.github.io`
- ネームサーバー: `NS1-3.XDOMAIN.NE.JP`（XServer Domain のDNSを使う設定）

## トップの「つくったもの」

- 並べる8本: TERRITORY WALK／画材ガチャ（`/sasabe-gacha/`）／アトリコ（`/art-supply-manager/`）／デート15文字（`/date-15/`）／
  地雷オセロ（`/mine-othello/`）／サザエさんとじゃんけん（`/sazae-janken/`）／時差じゃんけん（`/time-lag-janken/`）／嘘電卓（`/uso-dentaku/`）
- `#app-list` の中の `app-card--extra` が折りたたみ分。1本目〜3本目は常時表示。
- JSが読めない環境では全件そのまま表示し、ボタンは出ない（`.js` クラスで切り替え）。
- ツールを増やすときは `app-card--text` のカードを1枚足し、`app-card--extra` を付ける。
  「全○件」の数はJSが数えるので書き換え不要。

## 未対応（あとで）

- FogWalker（`/fog-walker/`）は休止中のため一覧から外している。再開したらカードを1枚足す。
