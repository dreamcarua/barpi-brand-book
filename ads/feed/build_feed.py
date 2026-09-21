#!/usr/bin/env python3
"""Build a Meta (Facebook) product catalog feed for barpi.com.ua.

Source of truth: the public site. Product list comes from Horoshop's
catalog-sitemap, categories from the four category pages, item data from
each product page (Open Graph + schema.org microdata). No admin access needed.

Output: ads/feed/meta-catalog.xml (RSS 2.0 with g: namespace, the format
Meta Commerce Manager accepts). Run daily by .github/workflows/meta-feed.yml.
"""
import html
import re
import sys
import time
import urllib.request
from xml.sax.saxutils import escape

SITE = "https://barpi.com.ua"
SITEMAP = f"{SITE}/content/export/barpi.com.ua/catalog-sitemap.xml"
CATEGORIES = {
    "/dehustatsiini-nabory-lasoshchiv/": "Дегустаційні набори ласощів",
    "/naturalni-lasoshchi-dlia-sobak/": "Натуральні ласощі для собак",
    "/naturalni-lasoshchi-dlia-kotiv/": "Натуральні ласощі для котів",
    "/apetaizery-toppery-dlia-sobak-ta-kotiv/": "Апетайзери (топпери) для собак та котів",
}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
OUT = sys.argv[1] if len(sys.argv) > 1 else "meta-catalog.xml"

_cookie = None


def get(url, retries=3):
    """GET with the site's JS-challenge cookie (challenge_passed=<hash>)."""
    global _cookie
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "uk"})
        if _cookie:
            req.add_header("Cookie", _cookie)
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8", "replace")
        m = re.search(r'defaultHash = "([0-9a-f]{64})"', body)
        if m and len(body) < 2000:
            _cookie = f"challenge_passed={m.group(1)}"
            time.sleep(1)
            continue
        return body
    raise RuntimeError(f"challenge not passed for {url}")


def meta(body, prop, attr="property"):
    m = re.search(r'<meta\s+%s="%s"\s+content="([^"]*)"' % (attr, re.escape(prop)), body)
    return html.unescape(m.group(1)).strip() if m else ""


def itemprop(body, name):
    m = re.search(r'itemprop="%s"[^>]*?(?:content|href)="([^"]*)"' % re.escape(name), body)
    return html.unescape(m.group(1)).strip() if m else ""


def full_description(body):
    m = re.search(r'itemprop="description"[^>]*>(.*?)</(?:div|section)>', body, re.S)
    if not m:
        return ""
    text = re.sub(r"<[^>]+>", " ", m.group(1))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def product_urls():
    body = get(SITEMAP)
    return [u for u in re.findall(r"<loc>([^<]+)</loc>", body)]


def category_map():
    """product path -> category name, from the category listing pages."""
    cmap = {}
    for path, name in CATEGORIES.items():
        body = get(SITE + path)
        for href in set(re.findall(r"catalogCard-image[^>]*?href=['\"](/[^'\"]+/)['\"]|href=['\"](/[^'\"]+/)['\"][^>]*class=['\"]catalogCard-image", body)):
            href = href[0] or href[1]
            if href in CATEGORIES or href == "/":
                continue
            cmap.setdefault(href, name)
    return cmap


def build_item(url, cmap):
    body = get(url)
    if "product:price:amount" not in body:
        return None  # 404 / not a product page
    path = "/" + url.replace(SITE, "").strip("/") + "/"
    sku = itemprop(body, "sku") or path.strip("/")
    price = meta(body, "product:price:amount")
    currency = meta(body, "product:price:currency") or "UAH"
    avail = itemprop(body, "availability")
    availability = "in stock" if avail.endswith("InStock") else "out of stock"
    title = meta(body, "og:title")
    desc = full_description(body) or meta(body, "og:description") or title
    image = meta(body, "og:image")
    if image and "/content/images/" in image:
        # take the largest rendition Horoshop offers
        image = re.sub(r"/\d+x\d+l\d+[a-z]{2}\d/", "/1080x1350l95mc0/", image)
    category = cmap.get(path, "")
    is_cat = category == CATEGORIES["/naturalni-lasoshchi-dlia-kotiv/"] or "kotiv" in path
    return {
        "id": sku,
        "title": title[:150],
        "description": desc[:5000],
        "link": url,
        "image_link": image,
        "price": f"{price} {currency}",
        "availability": availability,
        "condition": "new",
        "brand": "Barpi",
        "product_type": f"Barpi > {category}" if category else "Barpi",
        "google_product_category": "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Treats"
        if is_cat else "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Treats",
        "custom_label_0": "sets" if category == CATEGORIES["/dehustatsiini-nabory-lasoshchiv/"] or "set-" in path else (
            "appetizers" if "apetaiz" in path else "treats"),
        "custom_label_1": "cats" if is_cat else "dogs",
    }


def main():
    urls = product_urls()
    cmap = category_map()
    items = []
    for u in urls:
        try:
            it = build_item(u, cmap)
        except Exception as e:  # keep the feed alive if one page breaks
            print(f"WARN {u}: {e}", file=sys.stderr)
            continue
        if it:
            items.append(it)
        time.sleep(0.5)
    if len(items) < 5:
        raise SystemExit(f"only {len(items)} items parsed — refusing to overwrite feed")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
             "<channel>",
             "<title>Barpi — натуральні ласощі для собак і котів</title>",
             f"<link>{SITE}/</link>",
             "<description>Product catalog feed for Meta, built from barpi.com.ua</description>"]
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
        print(f"  {it['id']:<22} {it['price']:<12} {it['availability']:<12} {it['custom_label_1']:<5} {it['product_type']}")


if __name__ == "__main__":
    main()
