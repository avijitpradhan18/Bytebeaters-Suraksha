from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base

class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    extracted_text = Column(Text) 
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())
class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    banned_keyword = Column(String(255), unique=True, index=True) # E.g., an Aadhaar number or Name
    reason = Column(String(255))