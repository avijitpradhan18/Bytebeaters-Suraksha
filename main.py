import re
import joblib
import easyocr
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from deepface import DeepFace

import models
import screening                                   # NEW: document screening features
from database import engine, SessionLocal

reader = easyocr.Reader(['en'])
DOC_MODEL = joblib.load("aadhaar_screen_model.joblib")   # NEW: loaded once at startup

# If True, a photo with NO detectable face counts as a mismatch (safer).
# Leave False while testing with invented cards that have no face on them;
# set True before a real demo, and use real face photos.
STRICT_FACE = False

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Lets the browser frontend (opened from a file or another port) call this API.
# "*" is fine for a local demo; replace with your real frontend URL when deploying.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class WatchlistRequest(BaseModel):
    banned_keyword: str
    reason: str


@app.post("/api/watchlist/add")
def add_to_watchlist(request: WatchlistRequest, db: Session = Depends(get_db)):
    new_entry = models.Watchlist(banned_keyword=request.banned_keyword, reason=request.reason)
    db.add(new_entry)
    db.commit()
    return {"message": f"Added '{request.banned_keyword}' to the Red Notice Watchlist."}


@app.post("/api/scan")
async def scan_document(
    document: UploadFile = File(...),
    live_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # 1. Process the ID document
    doc_bytes = await document.read()
    doc_img = cv2.imdecode(np.frombuffer(doc_bytes, np.uint8), cv2.IMREAD_COLOR)

    # 2. Process the live photo
    live_bytes = await live_photo.read()
    live_img = cv2.imdecode(np.frombuffer(live_bytes, np.uint8), cv2.IMREAD_COLOR)

    # 3. 1:1 face verification
    try:
        verification = DeepFace.verify(
            img1_path=doc_img,
            img2_path=live_img,
            enforce_detection=STRICT_FACE,
            detector_backend="mtcnn",
            model_name="Facenet512",
        )
        match_distance = round(verification["distance"], 2)
        is_match = match_distance < 0.45
    except Exception as e:
        print(f"DEEPFACE ERROR: {str(e)}")
        is_match = False
        match_distance = "Error detecting face"

    # 4. OCR
    extracted_string = " ".join(reader.readtext(doc_bytes, detail=0))

    # 5. NEW: document text screening (risk score + reasons)
    doc = screening.screen(extracted_string, DOC_MODEL)

    # 6. Save to database - NEW: Aadhaar numbers masked (only last 4 digits kept)
    new_scan = models.ScanRecord(
        filename=document.filename,
        extracted_text=screening.mask_aadhaar(extracted_string),
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    # 7. Watchlist check (uses the raw text; also matches numbers written without spaces)
    digits_only = re.sub(r"\D", "", extracted_string)
    is_banned, ban_reason = False, ""
    for item in db.query(models.Watchlist).all():
        kw = item.banned_keyword.lower()
        kw_digits = re.sub(r"\D", "", kw)
        if kw in extracted_string.lower() or (len(kw_digits) >= 8 and kw_digits in digits_only):
            is_banned, ban_reason = True, item.reason
            break

    # 8. Final decision
    if is_banned:
        final_status = f"DETAIN - WATCHLIST MATCH: {ban_reason}"
    elif not is_match:
        final_status = "DETAIN - FACE MISMATCH"
    elif doc["label"] == "SUSPICIOUS":
        final_status = "REVIEW - SUSPICIOUS DOCUMENT TEXT"      # a human decides, not the model
    else:
        final_status = "PASS"

    return {
        "status": final_status,
        "face_match_verified": is_match,
        "match_distance_score": match_distance,
        "doc_risk_score": doc["risk_score"],
        "doc_label": doc["label"],
        "doc_flags": doc["reasons"],
        "record_id": new_scan.id,
        # extracted_text is intentionally NOT returned (it contains the Aadhaar number)
    }
