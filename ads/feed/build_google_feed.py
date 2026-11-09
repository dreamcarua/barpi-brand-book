#!/usr/bin/env python3
"""Google Merchant Center feed for barpi.com.ua (free listings).

Reuses the page parser of build_feed.py (Meta feed) and adds what Google needs:
- gtin only when it is a real EAN-13 (valid check digit, not the internal
  482122112xxxx series); otherwise identifier_exists=no;
- big packs (50/60/70 g) that are not in Horoshop's sitemap, grouped with the
  small pack via item_group_id and told apart by size + weight in the title;
- is_bundle for sets/naboru.
Price and availability come from the product page itself: Google checks the
feed against the landing page, and MoySklad stock is not reliable (negative
balances, checked 09.11.2026).

Output: ads/feed/google-merchant.xml. Run daily by .github/workflows/meta-feed.yml.
"""
import re
import sys
import time
from xml.sax.saxutils import escape

import build_feed as bf

OUT = sys.argv[1] if len(sys.argv) > 1 else "google-merchant.xml"

# Big-pack pages: separate Horoshop URLs, canonical -> small pack, not in sitemap.
# small-pack path -> big-pack path (checked 09.11.2026).
BIG_PACKS = {
    "/kuriachi-shlunky-barpi-20g/": "/kuriachi-shlunky-barpi-70g/",
    "/yalovyche-vymia-barpi-20g/": "/yalovyche-vymia-barpi-70g/",
    "/yalovycha-pechinka-barpi-20g/": "/yalovycha-pechinka-barpi-70g/",
    "/yalovycha-trakheia-barpi-20g/": "/yalovycha-trakheia-barpi-70g/",
    "/syr-stiky-barpi-20g/": "/syr-stiky-barpi-70g/",
    "/yalovycha-stanova-zhyla-barpi-20g/": "/yalovycha-stanova-zhyla-barpi-70g/",
    "/kuriachi-serdechka-barpi-20g/": "/kuriachi-serdechka-barpi-70g/",
    "/yalovychyi-rubets-barpi-15g/": "/yalovychyi-rubets-barpi-60g/",
    "/yalovychi-leheni-barpi-15g/": "/yalovychi-leheni-barpi-50g/",
}
INTERNAL_EAN = re.compile(r"^482122112")


def valid_ean13(code):
    if not re.fullmatch(r"\d{13}", code or "") or INTERNAL_EAN.match(code):
        return False
    s = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(code[:12]))
    return (10 - s % 10) % 10 == int(code[12])


def page_weight(body):
    """Active 'нетто, грам' modification button, e.g. '70г' -> '70 г'."""
    m = re.search(r'modification__button--active">\s*(\d+)\s*г', body)
    return f"{m.group(1)} г" if m else ""


def google_item(url, cmap, group=None):
    it = bf.build_item(url, cmap)
    if not it:
        return None
    body = bf.get(url)
    gtin = bf.itemprop(body, "gtin13") or bf.itemprop(body, "gtin")
    path = "/" + url.replace(bf.SITE, "").strip("/") + "/"
    weight = page_weight(body) if (group is not None or path in BIG_PACKS) else ""
    title = re.sub(r"\s*\|\s*Barpi\s*$", "", it["title"]).strip()
    if weight and not re.search(r"\b%s\s*г" % weight.split()[0], title):
        title = f"{title}, {weight}"
    it["title"] = title[:150]
    if group:
        # big-pack pages inherit the small pack's category
        it["product_type"] = group["product_type"]
        it["google_product_category"] = group["google_product_category"]
        it["custom_label_0"] = group["custom_label_0"]
        it["custom_label_1"] = group["custom_label_1"]
    out = {k: it[k] for k in ("id", "title", "description", "link", "image_link",
                               "price", "availability", "condition", "brand",
                               "google_product_category", "product_type")}
    if valid_ean13(gtin):
        out["gtin"] = gtin
    else:
        out["identifier_exists"] = "no"
    if it["custom_label_0"] == "sets" or "nabir" in path or "set-" in path:
        out["is_bundle"] = "yes"
    if group is not None or path in BIG_PACKS:
        out["item_group_id"] = (group or it)["id"]
        if weight:
            out["size"] = weight
    out["custom_label_0"] = it["custom_label_0"]
    out["custom_label_1"] = it["custom_label_1"]
    return out


def main():
    cmap = bf.category_map()
    items = []
    for u in bf.product_urls():
        path = "/" + u.replace(bf.SITE, "").strip("/") + "/"
        try:
            small = google_item(u, cmap)
        except Exception as e:
            print(f"WARN {u}: {e}", file=sys.stderr)
            continue
        if not small:
            continue
        items.append(small)
        if path in BIG_PACKS:
            big = BIG_PACKS[path]
            try:
                b = google_item(bf.SITE + big, cmap, group=small)
                if b:
                    items.append(b)
            except Exception as e:
                print(f"WARN {big}: {e}", file=sys.stderr)
        time.sleep(0.5)
    if len(items) < 5:
        raise SystemExit(f"only {len(items)} items parsed — refusing to overwrite feed")
    ids = [i["id"] for i in items]
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        raise SystemExit(f"duplicate ids {dup} — refusing to write feed")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
             "<channel>",
             "<title>Barpi — натуральні ласощі для собак і котів</title>",
             f"<link>{bf.SITE}/</link>",
             "<description>Google Merchant Center feed, built from barpi.com.ua</description>"]
    for it in items:
        lines.append("<item>")
        for k, v in it.items():
            lines.append(f"<g:{k}>{escape(v)}</g:{k}>")
        lines.append("</item>")
    lines += ["</channel>", "</rss>", ""]
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"wrote {OUT}: {len(items)} items")
    for it in items:
        print(f"  {it['id']:<14} {it['price']:<10} {it['availability']:<9} "
              f"{it.get('gtin', 'no-gtin'):<14} {it.get('item_group_id', ''):<8} {it['title'][:60]}")


if __name__ == "__main__":
    main()
