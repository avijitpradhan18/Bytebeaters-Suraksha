from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session
import easyocr
import cv2
import numpy as np
from deepface import DeepFace  # NEW IMPORT

import models
from database import engine, SessionLocal

reader = easyocr.Reader(['en'])
models.Base.metadata.create_all(bind=engine)
app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from pydantic import BaseModel

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
    db: Session = Depends(get_db)
):
    
    # 1. Process the ID Document
    doc_bytes = await document.read()
    doc_arr = np.frombuffer(doc_bytes, np.uint8)
    doc_img = cv2.imdecode(doc_arr, cv2.IMREAD_COLOR)
    
    # 2. Process the Live Photo
    live_bytes = await live_photo.read()
    live_arr = np.frombuffer(live_bytes, np.uint8)
    live_img = cv2.imdecode(live_arr, cv2.IMREAD_COLOR)

    # 3. 1:1 Face Verification
    try:
        verification = DeepFace.verify(
            img1_path=doc_img, 
            img2_path=live_img, 
            enforce_detection=False,
            detector_backend="mtcnn",
            model_name="Facenet512" 
        )
        match_distance = round(verification["distance"], 2)
        is_match = match_distance < 0.45
    except Exception as e:
        print(f"DEEPFACE CRASHED: {str(e)}")
        is_match = False
        match_distance = "Error detecting face"

    # 4. Extract Text with EasyOCR
    extracted_array = reader.readtext(doc_bytes, detail=0)
    extracted_string = " ".join(extracted_array)

    # 5. Save to Database
    new_scan = models.ScanRecord(
        filename=document.filename,
        extracted_text=extracted_string
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

   # 6. Cross-Reference the Red Notice Watchlist
    watchlist_items = db.query(models.Watchlist).all()
    is_banned = False
    ban_reason = ""
    
    for item in watchlist_items:
        # If any banned keyword (name or ID) is found inside the OCR text
        if item.banned_keyword.lower() in extracted_string.lower():
            is_banned = True
            ban_reason = item.reason
            break

    # 7. Final Security Decision Logic
    if is_banned:
        final_status = f"DETAIN - WATCHLIST MATCH: {ban_reason}"
    elif is_match:
        final_status = "PASS"
    else:
        final_status = "DETAIN - FACE MISMATCH"

    return {
        "status": final_status, 
        "face_match_verified": is_match,
        "match_distance_score": match_distance,
        "record_id": new_scan.id,
        "extracted_text": extracted_string
    }