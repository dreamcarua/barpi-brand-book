#!/usr/bin/env python3
"""Пам'ятка автора Barpi (influencer-director, етап 6, 26.11.2026). Шаблон тут + тексти в <lang>.json.
Результат: memo-<lang>.html для поля сторінки Horoshop (сторінка лише за посиланням: noindex, не в меню, не в sitemap).
Стилі: bp.css блок «memo» (.bp-memo). Анімації: .bp-rv з bp.js (лоадер вантажить bp.js для адреси сторінки).
Факти лише з карток товарів і /details/ на barpi.com.ua, перевірено перед публікацією.
Запуск: python3 site-embed/pages/memo/build_memo.py"""
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = "https://brand.barpi.ua/site-embed/img/"
E = html.escape


def page(t):
    o = ['<div class="bp bp-memo">']
    o.append('<section class="bp-sec bp-hero bp-mm-hero"><div><span class="bp-eyebrow">%s</span><h1>%s</h1><p class="bp-lead">%s</p>'
             '<p class="bp-mm-adult">%s</p><div class="bp-mm-stats">%s</div></div><div class="bp-hero-img bp-mm-hero-img"><img alt="Собака бере смаколик Barpi з рук, поруч пачка «Серденька курячі»" '
             'loading="eager" fetchpriority="high" src="%sugc6.webp" width="600" height="1066" /></div></section>'
             % (E(t["eyebrow"]), E(t["h1"]), E(t["lead"]), E(t["adult"]),
                "".join('<div class="bp-mm-stat bp-rv"><b>%s</b><span>%s</span></div>' % (E(a), E(b)) for a, b in t["stats"]), IMG))
    o.append('<section class="bp-sec bp-rv"><h2>%s</h2><div class="bp-card bp-mm-who">%s</div></section>'
             % (E(t["who_h"]), "".join("<p>%s</p>" % E(x) for x in t["who"])))
    cards = "".join('<a class="bp-mm-prod bp-rv" href="%s?utm_source=memo&amp;utm_medium=creators&amp;utm_campaign=creators" target="_blank" rel="noopener">'
                    '<span class="bp-mm-pack"><img alt="Пачка Barpi %s" loading="lazy" src="%s%s.webp" width="208" height="420" /></span><b>%s</b><span>%s</span><em>на сайті ↗</em></a>'
                    % (E(p["url"]), E(p["t"]), IMG, E(p["img"]), E(p["t"]), E(p["s"])) for p in t["products"])
    o.append('<section class="bp-sec"><h2>%s</h2><div class="bp-mm-prods">%s</div><p class="bp-small">%s</p></section>'
             % (E(t["prod_h"]), cards, E(t["prod_note"])))
    o.append('<section class="bp-sec bp-rv"><h2>%s</h2><ol class="bp-mm-steps">%s</ol></section>'
             % (E(t["how_h"]), "".join("<li><b>%s</b><span>%s</span></li>" % (E(a), E(b)) for a, b in t["how"])))
    o.append('<section class="bp-sec bp-rv"><h2>%s</h2><ul class="bp-check">%s</ul></section>'
             % (E(t["terms_h"]), "".join("<li>%s</li>" % E(x) for x in t["terms"])))
    o.append('<section class="bp-sec bp-mm-safe bp-rv"><h2>%s</h2><p class="bp-mm-vet">%s</p><ul class="bp-check bp-mm-warn">%s</ul><a class="bp-btn bp-btn--sec" href="%s" target="_blank" rel="noopener">%s</a></section>'
             % (E(t["safe_h"]), E(t["safe_first"]), "".join("<li>%s</li>" % E(x) for x in t["safe"]), E(t["safe_link"][1]), E(t["safe_link"][0])))
    o.append('<section class="bp-sec bp-rv"><h2>%s</h2><div class="bp-mm-words"><table><thead><tr><th>%s</th><th>%s</th></tr></thead><tbody>%s</tbody></table></div></section>'
             % (E(t["words_h"]), E(t["words_cols"][0]), E(t["words_cols"][1]),
                "".join('<tr><td class="ok">%s</td><td class="no">%s</td></tr>' % (E(a), E(b)) for a, b in t["words"])))
    o.append('<section class="bp-sec"><h2>%s</h2><div class="bp-mm-ideas">%s</div><h3 class="bp-mm-h3">%s</h3><ul class="bp-check">%s</ul></section>'
             % (E(t["ideas_h"]), "".join('<div class="bp-mm-idea bp-rv"><span class="bp-mm-n">%02d</span><h3>%s</h3><p>%s</p></div>' % (i + 1, E(a), E(b)) for i, (a, b) in enumerate(t["ideas"])),
                E(t["tips_title"]), "".join("<li>%s</li>" % E(x) for x in t["tips"])))
    o.append('<section class="bp-sec bp-mm-contact bp-rv"><h2>%s</h2><p>%s</p><div class="bp-btns"><a class="bp-btn bp-mm-cbtn" href="mailto:office@barpi.ua">Написати на office@barpi.ua</a> '
             '<a class="bp-btn bp-mm-cbtn" href="https://www.instagram.com/barpi.ua/" target="_blank" rel="noopener">Instagram @barpi.ua</a></div></section>' % (E(t["contact_h"]), E(t["contact"])))
    o.append("</div>")
    return "\n".join(o)


def main():
    for f in sorted(os.listdir(HERE)):
        if f.endswith(".json"):
            t = json.load(open(os.path.join(HERE, f), encoding="utf-8"))
            out = os.path.join(HERE, "memo-%s.html" % f[:-5])
            s = page(t)
            assert "—" not in s, "long dash in memo"
            open(out, "w", encoding="utf-8").write(s)
            print(out, len(s))


if __name__ == "__main__":
    main()
