# Work-Repo
 
## Lunch signup app
 
This repo contains a simple Node/Express + SQLite web app for team lunch signups.
 
## Features
- **3 preconfigured lunches** (date/time + location)
- **Signup cap**: max **6 people per lunch**
- Collects **name**, **email**, and **team**
- Stores signups in a local **SQLite** database on the server
 
## Configure lunches
Edit `server.js` and update the `LUNCHES` array (title, `starts_at`, location).
 
## Run locally
1. Install dependencies:
 
    ```bash
    npm install
    ```
 
2. Start the server:
 
    ```bash
    npm run dev
    ```
 
3. Open:
 
    `http://localhost:3000`
 
## Data storage
The SQLite database file is created at `data/lunch-signups.db`.