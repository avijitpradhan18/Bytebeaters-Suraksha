"""
screening.py  -  shared by the Kaggle notebook (training) and the FastAPI backend (serving).
Same feature code in both places = no train/serve mismatch.
"""
import re
from datetime import date
from difflib import SequenceMatcher, get_close_matches

# ---------------- Verhoeff checksum (used by Aadhaar numbers) ----------------
_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
      [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
      [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
      [9,8,7,6,5,4,3,2,1,0]]
_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
      [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
      [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]]
_INV = [0,4,3,2,1,5,6,7,8,9]

def verhoeff_valid(num: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0

def verhoeff_check_digit(num_without_check: str) -> str:
    c = 0
    for i, ch in enumerate(reversed(num_without_check)):
        c = _D[c][_P[(i + 1) % 8][int(ch)]]
    return str(_INV[c])

def aadhaar_valid(num: str) -> bool:
    num = re.sub(r"\D", "", num)
    return len(num) == 12 and num[0] not in "01" and verhoeff_valid(num)

# ---------------- Parsing OCR text ----------------
# 12 digits, in groups of 4, separated by space / slash / underscore / dash (OCR is messy).
# The lookahead stops us matching the first 12 digits of a 16-digit VID.
AADHAAR_RE = re.compile(r"(?<!\d)(?<!\d{4}[\s/_\-])(\d{4})[\s/_\-]?(\d{4})[\s/_\-]?(\d{4})(?!\d|[\s]?\d{4})")
DOB_RE     = re.compile(r"(?<!\d)(\d{2})[/\-.](\d{2})[/\-.](\d{4})(?!\d)")
YOB_RE     = re.compile(r"(?:year\s*of\s*birth|yob)\s*[:\-]?\s*(\d{4})", re.I)
PIN_RE     = re.compile(r"pin\s*code\s*[:\-]?\s*(\d{3,8})", re.I)
NAME_RE    = re.compile(r"\b([A-Z][a-z]{2,}(?: [A-Z][a-z]{2,}){1,2})\b")

NOT_NAMES = {"government","india","unique","identification","authority","enrollment",
             "aadhaar","your","state","district","mobile","code","street","road","nagar",
             "west","bengal","vtc","male","female","address","download","issued","lane","avenue",
             "view","lake","temple","market","park","station","pradesh","nadu","mobile"}

KEYWORDS = ["government", "india", "unique", "identification", "authority",
            "aadhaar", "enrollment", "male", "female"]


def _name_candidates(t):
    """Runs of 2-3 consecutive Capitalised words, split at header/address words like 'India'."""
    cands, run = [], []
    def flush():
        if 2 <= len(run) <= 3:
            cands.append(" ".join(run))
        run.clear()
    for tok in re.findall(r"[A-Za-z]+|\S", t):
        if re.fullmatch(r"[A-Z][a-z]{2,}", tok) and tok.lower() not in NOT_NAMES:
            run.append(tok)
        else:
            flush()
    flush()
    return cands

def _hit(word, tokens):
    return 1 if get_close_matches(word, tokens, n=1, cutoff=0.8) else 0

def _valid_date(d, m, y):
    try:
        dt = date(y, m, d)
        return dt, 1900 <= y <= date.today().year
    except ValueError:
        return None, False

FEATURE_NAMES = [
    "n_aadhaar", "n_distinct_aadhaar", "any_aadhaar_valid", "frac_aadhaar_valid",
    "aadhaar_mismatch", "dob_found", "dob_valid", "dob_age", "dob_mismatch",
    "pin_found", "pin_len_ok", "kw_hits", "gender_hit", "name_sim",
    "text_len", "n_tokens", "junk_ratio", "digit_ratio",
]

def extract_features(text: str) -> dict:
    t = text or ""
    low = t.lower()
    tokens = re.findall(r"[a-z]{3,}", low)

    # --- Aadhaar numbers ---
    nums = ["".join(m.groups()) for m in AADHAAR_RE.finditer(t)]
    valid = [aadhaar_valid(n) for n in nums]
    distinct = set(nums)

    # --- DOB ---
    dobs = []
    for m in DOB_RE.finditer(t):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        dt, ok = _valid_date(d, mo, y)
        dobs.append((m.group(0), dt, ok))
    yob = YOB_RE.search(t)
    dob_valid, age = 0, -1
    if dobs:
        good = [x for x in dobs if x[2] and x[1] <= date.today()]
        dob_valid = 1 if good else 0
        if good:
            age = (date.today() - good[0][1]).days // 365
            age = age if 0 <= age <= 120 else -1
    elif yob:
        y = int(yob.group(1))
        if 1900 <= y <= date.today().year:
            dob_valid, age = 1, date.today().year - y

    # --- PIN ---
    pin = PIN_RE.search(t)
    pin_len_ok = 1 if (pin and len(pin.group(1)) == 6 and pin.group(1)[0] != "0") else 0

    # --- Names: do the two name sections agree? ---
    cands = _name_candidates(t)
    name_sim = 0.0
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            name_sim = max(name_sim, SequenceMatcher(None, cands[i], cands[j]).ratio())

    n = max(len(t), 1)
    return {
        "n_aadhaar": len(nums),
        "n_distinct_aadhaar": len(distinct),
        "any_aadhaar_valid": int(any(valid)),
        "frac_aadhaar_valid": (sum(valid) / len(valid)) if valid else 0.0,
        "aadhaar_mismatch": int(len(nums) >= 2 and len(distinct) > 1),
        "dob_found": int(bool(dobs) or bool(yob)),
        "dob_valid": dob_valid,
        "dob_age": age,
        "dob_mismatch": int(len({x[0] for x in dobs}) > 1),
        "pin_found": int(bool(pin)),
        "pin_len_ok": pin_len_ok,
        "kw_hits": sum(_hit(w, tokens) for w in KEYWORDS[:7]),
        "gender_hit": int(_hit("male", tokens) or _hit("female", tokens)),
        "name_sim": round(name_sim, 3),
        "text_len": len(t),
        "n_tokens": len(t.split()),
        "junk_ratio": sum(not (c.isalnum() or c.isspace()) for c in t) / n,
        "digit_ratio": sum(c.isdigit() for c in t) / n,
    }

def featurize(text: str):
    f = extract_features(text)
    return [f[k] for k in FEATURE_NAMES]

def explain(f: dict) -> list:
    """Human-readable reasons, shown on the dashboard. Never includes the raw numbers."""
    r = []
    if f["n_aadhaar"] == 0:
        r.append("No 12-digit Aadhaar number could be read")
    elif not f["any_aadhaar_valid"]:
        r.append("Aadhaar number fails the Verhoeff checksum")
    if f["aadhaar_mismatch"]:
        r.append("Aadhaar number differs between sections of the card")
    if not f["dob_found"]:
        r.append("No date of birth found")
    elif not f["dob_valid"]:
        r.append("Date of birth is invalid")
    if f["dob_mismatch"]:
        r.append("Date of birth differs between sections")
    if f["pin_found"] and not f["pin_len_ok"]:
        r.append("PIN code is not a valid 6-digit PIN")
    if f["kw_hits"] < 4:
        r.append("Expected UIDAI header text is missing or garbled")
    if 0 < f["name_sim"] < 0.7:
        r.append("Name looks inconsistent between sections")
    return r

def screen(text: str, bundle: dict) -> dict:
    """bundle = joblib.load('aadhaar_screen_model.joblib')"""
    f = extract_features(text)
    x = [[f[k] for k in bundle["feature_names"]]]
    p = float(bundle["model"].predict_proba(x)[0][1])
    return {
        "risk_score": int(round(p * 100)),
        "label": "SUSPICIOUS" if p >= bundle["threshold"] else "OK",
        "reasons": explain(f),
    }

# ---------------- Privacy helper: mask before saving to the database ----------------
def mask_aadhaar(text: str) -> str:
    """'2345 6789 0123' -> 'XXXX XXXX 0123' (keeps last 4 digits only)."""
    return AADHAAR_RE.sub(lambda m: "XXXX XXXX " + m.group(3), text or "")
