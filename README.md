# EVE Online PLEX Market Tracker

This is a full-stack web application that tracks and displays the market data for PLEX (Pilot's License Extension) in the popular MMORPG, EVE Online. It provides real-time price updates and historical data visualization to help players make informed trading decisions.

## Features

*   **Real-time Price Updates:** Live PLEX market data pushed to the frontend using WebSockets.
*   **Historical Data Charts:** Interactive charts displaying historical price data with selectable timeframes (5M, 1H, 1D, 1W, 1M).
*   **Automated Data Fetching:** The backend automatically fetches the latest market data from the EVE Tycoon API every 5 minutes.
*   **EVE-Inspired UI:** A dark mode theme inspired by the EVE Online user interface.
*   **Containerized:** The entire application is containerized using Docker for easy setup and deployment.

## Tech Stack

*   **Frontend:** React, Lightweight Charts
*   **Backend:** FastAPI (Python), Uvicorn, WebSockets
*   **Database:** PostgreSQL
*   **Deployment:** Docker, Docker Compose, Cloudflare Tunnel

## Getting Started

Follow these instructions to get a local copy of the project up and running.

### Prerequisites

*   [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Set up environment variables:**
    Create a `.env` file by copying the example file.
    ```sh
    cp .env.example .env
    ```
    Open the `.env` file and add your Cloudflare Tunnel Token. If you are not using Cloudflare Tunnel for exposure, you can leave the default value, but you will need to configure access to the services differently (e.g., by exposing ports in `docker-compose.yml`).
    ```
    # .env
    TUNNEL_TOKEN=your_tunnel_token_here
    ```

3.  **Build and run the application:**
    Use Docker Compose to build the images and start the services in detached mode.
    ```sh
    docker compose up --build -d
    ```

4.  **Access the application:**
    The application should now be running. The frontend will be accessible on `http://localhost:3000`.