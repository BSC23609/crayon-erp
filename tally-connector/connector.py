"""Crayon ERP -> TallyPrime connector.

Runs on the Tally PC (or any PC on the same network as Tally). Every POLL_SECONDS it:
  1. asks the ERP for pending Tally entries   GET  {ERP_URL}/api/tally/outbox
  2. posts each entry's XML to TallyPrime      POST http://{TALLY_HOST}:{TALLY_PORT}
  3. reports the result back to the ERP        POST {ERP_URL}/api/tally/ack

The connection is outbound only: nothing on this PC is opened to the internet.
TallyPrime must be running with the Crayon company open, and
F1 Help > Settings > Connectivity > "TallyPrime acts as" = Both, port 9000.

Config: config.ini next to this file (see config.example.ini) or environment variables.
"""
import configparser, json, logging, os, re, sys, time
import urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(sys.argv[0]))
cfg = configparser.ConfigParser()
cfg.read(os.path.join(HERE, "config.ini"))
C = lambda key, default=None: os.environ.get(key) or cfg.get("connector", key.lower(), fallback=default)

ERP_URL = C("ERP_URL", "https://erp.crayonroofings.com").rstrip("/")
KEY = C("TALLY_CONNECTOR_KEY", "")
TALLY = f"http://{C('TALLY_HOST', 'localhost')}:{C('TALLY_PORT', '9000')}"
POLL = int(C("POLL_SECONDS", "60"))

logging.basicConfig(filename=os.path.join(HERE, "connector.log"), level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("connector")

def http(method, url, body=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def erp(method, path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    raw = http(method, ERP_URL + path, body, {"X-Connector-Key": KEY, "Content-Type": "application/json"})
    return json.loads(raw)

def tally_alive():
    try:
        http("GET", TALLY, timeout=5)
        return True
    except Exception:
        return False

def post_to_tally(xml: str):
    """Returns (ok, voucher_or_master_id, error). Tally answers with CREATED/ALTERED/ERRORS counts."""
    raw = http("POST", TALLY, xml.encode("utf-8"), {"Content-Type": "text/xml;charset=utf-8"}, timeout=60).decode("utf-8", "replace")
    num = lambda tag: int((re.search(fr"<{tag}>(\d+)</{tag}>", raw) or [0, 0])[1])
    if num("ERRORS") == 0 and (num("CREATED") + num("ALTERED")) > 0:
        last = re.search(r"<LASTVCHID>(\d+)</LASTVCHID>", raw) or re.search(r"<LASTMID>(\d+)</LASTMID>", raw)
        return True, last[1] if last else None, None
    err = re.findall(r"<LINEERROR>(.*?)</LINEERROR>", raw, re.S)
    return False, None, ("; ".join(e.strip() for e in err) or raw[:500])

def run_once():
    if not tally_alive():
        log.warning("TallyPrime is not reachable at %s; entries stay queued in the ERP", TALLY)
        return 0
    items = erp("GET", "/api/tally/outbox?limit=20")
    acks = []
    for it in items:
        try:
            ok, ref, error = post_to_tally(it["xml"])
        except Exception as e:  # network or Tally error: report and let the ERP retry later
            ok, ref, error = False, None, f"{type(e).__name__}: {e}"
        acks.append({"id": it["id"], "ok": ok, "tally_voucher_no": ref, "error": error})
        log.info("entry %s (%s %s): %s", it["id"], it["entity"], it["entity_id"], "posted" if ok else f"failed: {error}")
    if acks:
        erp("POST", "/api/tally/ack", acks)
    return len(acks)

def main():
    if not KEY:
        sys.exit("TALLY_CONNECTOR_KEY is not set (config.ini or environment)")
    log.info("connector started: ERP=%s Tally=%s every %ss", ERP_URL, TALLY, POLL)
    while True:
        try:
            run_once()
        except urllib.error.URLError as e:
            log.warning("ERP not reachable: %s", e)
        except Exception:
            log.exception("unexpected error")
        if "--once" in sys.argv:
            break
        time.sleep(POLL)

if __name__ == "__main__":
    main()
