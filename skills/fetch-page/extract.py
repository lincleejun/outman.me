#!/usr/bin/env python3
"""Helper for ./fetch. Stdlib only.

  extract.py pick <page.html> [--all]   → html of the main content (article/main, else body), chrome stripped
  extract.py md                        → stdin html → rough markdown (fallback when pandoc is missing)
"""
import html, re, sys


def strip(s, *tags):
    for t in tags:
        s = re.sub(rf'<{t}\b[^>]*>.*?</{t}\s*>', ' ', s, flags=re.S | re.I)
    return s


def text_len(h):
    return len(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)))


def pick(path, everything):
    raw = open(path, encoding='utf-8', errors='replace').read()
    s = strip(raw, 'script', 'style', 'noscript', 'svg', 'template', 'iframe')
    s = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)
    m = re.search(r'<body\b[^>]*>(.*)</body>', s, re.S | re.I)
    body = m.group(1) if m else s
    out = body
    if not everything:
        cands = (re.findall(r'<article\b[^>]*>.*?</article\s*>', body, re.S | re.I)
                 or re.findall(r'<main\b[^>]*>.*?</main\s*>', body, re.S | re.I)
                 or re.findall(r'<[a-z]+\b[^>]*role=["\']main["\'][^>]*>.*?</(?:div|section)\s*>', body, re.S | re.I))
        if cands:
            best = max(cands, key=text_len)
            if text_len(best) >= 500 or text_len(best) >= 0.3 * text_len(body):
                out = best
        out = strip(out, 'nav', 'header', 'footer', 'aside', 'form', 'button')
    t = re.search(r'<title\b[^>]*>(.*?)</title>', raw, re.S | re.I)
    title = html.unescape(re.sub(r'\s+', ' ', t.group(1)).strip()) if t else ''
    if title and '<h1' not in out.lower():
        out = f'<h1>{html.escape(title)}</h1>\n' + out
    return out


def to_md(s):
    s = re.sub(r'<h([1-6])\b[^>]*>(.*?)</h\1>',
               lambda m: '\n' + '#' * int(m.group(1)) + ' ' + re.sub(r'<[^>]+>', '', m.group(2)).strip() + '\n',
               s, flags=re.S | re.I)
    s = re.sub(r'<pre\b[^>]*>(.*?)</pre>',
               lambda m: '\n```\n' + re.sub(r'<[^>]+>', '', m.group(1)) + '\n```\n', s, flags=re.S | re.I)
    s = re.sub(r'<li\b[^>]*>', '\n- ', s, flags=re.I)
    s = re.sub(r'</?(p|div|br|tr|section|blockquote|ul|ol|table)\b[^>]*>', '\n', s, flags=re.I)
    return html.unescape(re.sub(r'<[^>]+>', '', s))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'pick':
        sys.stdout.write(pick(sys.argv[2], '--all' in sys.argv[3:]))
    elif cmd == 'md':
        sys.stdout.write(to_md(sys.stdin.read()))
    else:
        sys.exit(__doc__)
