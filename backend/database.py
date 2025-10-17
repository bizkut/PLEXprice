from sqlalchemy import create_engine, Column, Integer, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/plex_market_data")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class PlexPrice(Base):
    __tablename__ = "plex_prices"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    highest_buy = Column(Float)
    lowest_sell = Column(Float)
    buy_volume = Column(Float)
    sell_volume = Column(Float)

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()