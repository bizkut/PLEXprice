from fastapi import FastAPI, Depends, WebSocket
from apscheduler.schedulers.background import BackgroundScheduler
from fetch_data import fetch_and_store_plex_data
from sqlalchemy.orm import Session
from database import SessionLocal, PlexPrice
import datetime
from websocket_manager import manager

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    # Fetch data on startup and then every 5 minutes
    fetch_and_store_plex_data()
    scheduler.add_job(fetch_and_store_plex_data, 'interval', minutes=5)
    scheduler.start()
    print("Scheduler started. Fetching data every 5 minutes.")

@app.get("/historical-data/")
def get_historical_data(timeframe: str = "1D", db: Session = Depends(get_db)):
    end_date = datetime.datetime.utcnow()
    if timeframe == "5M":
        start_date = end_date - datetime.timedelta(minutes=5)
    elif timeframe == "1H":
        start_date = end_date - datetime.timedelta(hours=1)
    elif timeframe == "1D":
        start_date = end_date - datetime.timedelta(days=1)
    elif timeframe == "1W":
        start_date = end_date - datetime.timedelta(weeks=1)
    elif timeframe == "1M":
        start_date = end_date - datetime.timedelta(days=30)
    else:
        start_date = end_date - datetime.timedelta(days=1)

    data = db.query(PlexPrice).filter(PlexPrice.timestamp.between(start_date, end_date)).all()
    return data

@app.get("/")
def read_root():
    return {"message": "Plex Market Data API"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive by waiting for messages
            await websocket.receive_text()
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        manager.disconnect(websocket)