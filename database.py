from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Make sure to put your actual MySQL root password here
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:Debayan%40123@127.0.0.1/qscan_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()