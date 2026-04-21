# SOUL ARCHIVE
### 6529 Identity Portrait

Ethereum cüzdan adresini gir — 6529 Memes ekosistemindeki kimliğin sürreal bir ruh portresine dönüşsün.

Hiçbir görsel dosya yok. Her şey kod ile üretiliyor (generative art).

Saf statik bundle — backend yok, build yok, framework yok. Sadece HTML + JS + canvas.

---

## Nasıl Çalışır

1. Cüzdan adresini gir
2. Tarayıcı 6529 API'den direkt veri çeker (TDH, Level, Unique Memes, vb.)
3. Bu parametreler Canvas üzerinde dinamik bir "ruh portresi" üretir
4. Portre animasyonlu — 10 dakikada bir otomatik refresh

---

## Çalıştırma

Backend gerektirmez. İki seçenek:

### A. Dosyayı direkt aç
`index.html`'i çift tıkla. (Bazı tarayıcılar `file://` üzerinden `fetch` izni vermez — o durumda B'ye bak.)

### B. Basit bir static server
```bash
# Python
python -m http.server 8000

# VEYA Node
npx serve
```
Sonra `http://localhost:8000` aç.

Demo için sayfanın altındaki **"load demo — punk6529"** linkine tıkla.

---

## Meme Artist Algılama

Proje kök dizininde `artist-index.json` var. Bu dosya **build-time'da** üretilir —
`/api/nfts` üzerinden tüm 6529 koleksiyonu çekilir, sadece **"The Memes by 6529"**
filtrelenir, her karttaki `artist_seize_handle` alanı ile handle ve consolidated
wallet mapping'i çıkarılır. Manuel override yok — tek kaynak 6529 API'sidir.

Yeni Memes kartı yayınlandığında yeniden oluşturmak için:

```bash
node build-artist-index.js
```

Gereksinim: Node 18+ (native `fetch`). ~15-20 saniye sürer.

---

## Ruh Sınıfları (TDH tier'ları)

| TDH Range     | Tier        | Kod           |
|---------------|-------------|---------------|
| 0             | UNBORN      | no render     |
| < 10K         | ECHO        | soluk iz      |
| 10K–99K       | SIGNAL      | form beliriyor|
| 100K–499K     | EMERGING    | şekilleniyor  |
| 500K–999K     | RESONANCE   | güçleniyor    |
| 1M–4.9M       | ANCHOR      | derinleşiyor  |
| 5M–9.9M       | PILLAR      | katmanlı      |
| 10M–14.9M     | MONUMENT    | iridescent    |
| 15M–19.9M     | LEGEND      | rare forms    |
| 20M+          | PHENOMENON  | tam spektrum  |

---

## Dosya Yapısı

```
soul-archive/
├── index.html              ← entry UI + app bootstrap
├── about.html              ← info sayfası
├── soul-organism.js        ← tüm render + API logic
├── artist-index.json       ← build-time üretilen artist mapping
├── build-artist-index.js   ← artist-index'i yeniden üretir
├── vendor/
│   ├── gif.js              ← GIF export
│   └── gif.worker.js
└── README.md
```

---

## Deploy

### GitHub Pages
1. Repo'yu push et (`artist-index.json` dahil)
2. Settings → Pages → Source: main branch, root
3. `https://<username>.github.io/soul-archive/` üzerinden erişilir

### IPFS wrapper
Root'a küçük bir `wrapper.html` (iframe) koy, Pinata/Fleek/web3.storage ile pinle.
