# shodai4.com — ポートフォリオ

`shodai4.com` で公開する個人サイト（静的HTML/CSSのみ・ビルド不要）。
前面に出すのは iOS / Web アプリ **TERRITORY WALK** の1本と、絵の活動（アトリエ三月 年末展2026・ZINE・BASEショップ）。

## 中身

| ファイル | 役割 |
| --- | --- |
| `index.html` | トップページ（TERRITORY WALK／描いたもの／つくる人／つながる） |
| `styles.css` | 全スタイル（外部フォント・外部JSなし） |
| `404.html` | 404ページ |
| `CNAME` | `shodai4.com`（GitHub Pages のカスタムドメイン） |
| `app-ads.txt` | AdMob 用（`pub-5739782559889389`）。`shodai4/territory-walk` の同ファイルと同一内容 |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け |
| `.nojekyll` | Jekyll ビルドをスキップ |
| `assets/territory-walk.jpg` | TERRITORY WALK のスクリーンショット（1600px・約317KB） |
| `assets/og.jpg` | OGP/Twitterカード用（1200×630） |

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

## 未対応（あとで）

- 作品・アプリが増えたらトップに追加する（他6本は当面出さない方針）
