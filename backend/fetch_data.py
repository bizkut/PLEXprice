import requests
import datetime
import json
from sqlalchemy.orm import sessionmaker
from database import PlexPrice, engine
from websockets import manager

API_URL = "https://evetycoon.com/api/v1/market/orders/44992"

def fetch_and_store_plex_data():
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        response = requests.get(API_URL)
        response.raise_for_status()
        data = response.json()

        buy_orders = [order for order in data['orders'] if order['isBuyOrder']]
        sell_orders = [order for order in data['orders'] if not order['isBuyOrder']]

        highest_buy = max(order['price'] for order in buy_orders) if buy_orders else 0
        lowest_sell = min(order['price'] for order in sell_orders) if sell_orders else 0
        buy_volume = sum(order['volumeRemain'] for order in buy_orders)
        sell_volume = sum(order['volumeRemain'] for order in sell_orders)

        new_price_data = PlexPrice(
            timestamp=datetime.datetime.utcnow(),
            highest_buy=highest_buy,
            lowest_sell=lowest_sell,
            buy_volume=buy_volume,
            sell_volume=sell_volume
        )

        session.add(new_price_data)
        session.commit()

        # Broadcast the new data to all connected clients
        async def broadcast_data():
            await manager.broadcast(json.dumps({
                "timestamp": new_price_data.timestamp.isoformat(),
                "highest_buy": new_price_data.highest_buy,
                "lowest_sell": new_price_data.lowest_sell,
                "buy_volume": new_price_data.buy_volume,
                "sell_volume": new_price_data.sell_volume
            }))

        # Run the async broadcast function
        import asyncio
        asyncio.run(broadcast_data())

        print("Successfully fetched, stored, and broadcasted new PLEX data.")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from API: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    fetch_and_store_plex_data()