#!/usr/bin/env python3
"""ScreenDen scrub gate (public checks).

Scans a release tree and fails (exit 1) on strings that must never ship:
non-placeholder email addresses, build-machine paths, the private
edition's product name, and the removed private PDF guide constant.

Maintainers can add a local denylist at tools/denylist.local.txt (one
term per line, git-ignored): the full release gate for this project adds
the private instance's hostnames, names and addresses there. That list
is deliberately not published — a denylist that prints the strings it
hunts would leak them.

Usage: python3 tools/scrub-gate.py <tree>
(A gate never scans itself — it has to name the strings it hunts.)
"""
import os, re, sys

BLOCKING = [
    "Media Hub",               # the private edition's product name
    "FTP_GUIDE_PDF_BASE64",    # the removed private PDF guide
]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
EMAIL_OK = ("example.com", "example.org", "example.net", "your-domain.example")
HOME_PATH_RE = re.compile(r"/home/[A-Za-z0-9._-]+/")

def load_local_denylist():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "denylist.local.txt")
    if not os.path.isfile(p): return []
    return [l.strip() for l in open(p, encoding="utf-8") if l.strip() and not l.startswith("#")]

def main():
    if len(sys.argv) < 2:
        print("usage: scrub-gate.py <tree>"); return 2
    root = sys.argv[1]
    terms = BLOCKING + load_local_denylist()
    hits, files = [], 0
    for dirpath, dirnames, names in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git")]
        for name in sorted(names):
            if name == "scrub-gate.py": continue  # a gate never scans itself
            if os.path.splitext(name)[1].lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"}: continue  # binary images: no scannable text
            p = os.path.join(dirpath, name)
            rel = os.path.relpath(p, root)
            files += 1
            text = open(p, "rb").read().decode("utf-8", errors="ignore")
            for term in terms:
                n = text.count(term)
                if n: hits.append((rel, term, n))
            for m in EMAIL_RE.finditer(text):
                if not any(m.group(0).lower().endswith(d) for d in EMAIL_OK):
                    hits.append((rel, "non-placeholder email " + m.group(0), 1))
            for m in HOME_PATH_RE.finditer(text):
                if m.group(0) not in ("/home/you/",):
                    hits.append((rel, "build-machine path " + m.group(0), 1))
    print(f"scrub gate: {files} files scanned under {root}")
    if hits:
        print("BLOCKING HITS — release stops:")
        for rel, term, n in hits: print(f"  {rel}: {term!r} x{n}")
        return 1
    print("BLOCKING: 0 hits — gate green")
    return 0

if __name__ == "__main__":
    sys.exit(main())
