"""Dimzz Musik — API YouTube Music memakai library ytmusicapi (Python).
Berkas ini harus berada di api/ytm.py (ganti nama dari api-ytm.py). Butuh requirements.txt berisi: ytmusicapi
Aksi (?a=):  search&q=  | suggest&q=  | radio&id=  | charts[&c=ID]  | lyrics&id=
"""
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

_yt = None


def ytm():
    global _yt
    if _yt is None:
        from ytmusicapi import YTMusic
        try:
            _yt = YTMusic(language="id", location="ID")
        except Exception:
            _yt = YTMusic()
    return _yt


def to_sec(d):
    try:
        p = [int(x) for x in str(d).split(":")]
        s = 0
        for x in p:
            s = s * 60 + x
        return s
    except Exception:
        return 0


def best_thumb(th, vid):
    if isinstance(th, list) and th:
        try:
            u = max(th, key=lambda t: (t.get("width") or 0) * (t.get("height") or 0)).get("url") or ""
        except Exception:
            u = (th[-1] or {}).get("url") or ""
        if u:
            if "googleusercontent.com" in u or "ggpht.com" in u:
                u = re.sub(r"=w\d+-h\d+.*$", "=w544-h544-l90-rj", u)
            return u
    return "https://i.ytimg.com/vi/%s/hqdefault.jpg" % vid


def item(r, kind="Lagu"):
    if not isinstance(r, dict):
        return None
    vid, title = r.get("videoId"), r.get("title")
    if not vid or not title or not re.match(r"^[\w-]{11}$", vid):
        return None
    artists = r.get("artists") or []
    artist = ", ".join(a.get("name") for a in artists if isinstance(a, dict) and a.get("name")) or r.get("author") or ""
    alb = r.get("album")
    album = alb.get("name") if isinstance(alb, dict) else (alb or "")
    dur = r.get("duration") or r.get("length") or ""
    secs = r.get("duration_seconds") or to_sec(dur)
    return {
        "id": vid, "title": title, "artist": artist, "album": album or "",
        "duration": dur, "seconds": secs, "kind": kind,
        "thumb": best_thumb(r.get("thumbnails") or r.get("thumbnail") or [], vid),
    }


def items(rows, kind="Lagu", skip=None):
    out, seen = [], set()
    for r in rows or []:
        i = item(r, kind)
        if i and i["id"] not in seen and i["id"] != skip:
            seen.add(i["id"])
            out.append(i)
    return out


def act_search(q, p):
    if not q:
        raise ValueError("kata kunci kosong")
    res = items(ytm().search(q, filter="songs", limit=30))
    if not res:
        res = items(ytm().search(q, filter="videos", limit=30), "Video")
    return {"items": res, "provider": "ytmusicapi"}


def act_suggest(q, p):
    if not q:
        return {"items": []}
    return {"items": [s for s in (ytm().get_search_suggestions(q) or []) if isinstance(s, str)][:8]}


def act_radio(q, p):
    vid = p.get("id", "")
    if not re.match(r"^[\w-]{11}$", vid):
        raise ValueError("id tidak valid")
    d = ytm().get_watch_playlist(videoId=vid, limit=25, radio=True)
    return {"items": items(d.get("tracks"), "Lagu", skip=vid)}


def act_charts(q, p):
    country = (p.get("c") or "ID").upper()[:2]
    c = ytm().get_charts(country)
    pls = [x for x in (c.get("videos") or []) if x.get("playlistId")]
    if not pls:
        return {"items": [], "title": ""}
    pl = ytm().get_playlist(pls[0]["playlistId"], limit=30)
    return {"items": items(pl.get("tracks"), "Lagu"), "title": pls[0].get("title") or "Tangga lagu"}


def act_lyrics(q, p):
    vid = p.get("id", "")
    if not re.match(r"^[\w-]{11}$", vid):
        raise ValueError("id tidak valid")
    w = ytm().get_watch_playlist(videoId=vid, limit=1)
    bid = w.get("lyrics")
    if not bid:
        return {"synced": [], "plain": ""}
    try:
        l = ytm().get_lyrics(bid, timestamps=True) or {}
    except Exception:
        l = ytm().get_lyrics(bid) or {}
    raw = l.get("lyrics")
    if isinstance(raw, list):
        synced = []
        for x in raw:
            t = getattr(x, "text", None) if not isinstance(x, dict) else x.get("text")
            s = getattr(x, "start_time", None) if not isinstance(x, dict) else x.get("start_time")
            if t and s is not None:
                synced.append({"t": round(int(s) / 1000.0, 2), "x": t})
        return {"synced": synced, "plain": "\n".join(x["x"] for x in synced), "source": l.get("source")}
    return {"synced": [], "plain": raw or "", "source": l.get("source")}


ACTIONS = {
    "search": (act_search, "public, s-maxage=300, stale-while-revalidate=600"),
    "suggest": (act_suggest, "public, s-maxage=120"),
    "radio": (act_radio, "public, s-maxage=180"),
    "charts": (act_charts, "public, s-maxage=900, stale-while-revalidate=1800"),
    "lyrics": (act_lyrics, "public, s-maxage=3600"),
}


class handler(BaseHTTPRequestHandler):
    def _send(self, code, data, cache="no-store"):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", cache if code == 200 else "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        p = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        a, q = p.get("a", ""), (p.get("q") or "").strip()[:200]
        fn = ACTIONS.get(a)
        if not fn:
            return self._send(400, {"ok": False, "error": "aksi tidak dikenal"})
        try:
            d = fn[0](q, p)
            d["ok"] = True
            return self._send(200, d, fn[1])
        except ValueError as e:
            return self._send(400, {"ok": False, "error": str(e)})
        except Exception as e:
            return self._send(502, {"ok": False, "error": "YouTube Music: " + str(e)[:200]})
