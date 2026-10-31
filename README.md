# EcoTrack: E-Waste Recovery App

Hackathon project (Graviton, CGC University, Mohali). Team: *(Harpavit Singh, Nikhil Kungotra, Gurbeant Singh, Deepanshu)*

People scan waste with a phone camera. An AI model names the category (plastic, cardboard, paper, metal, glass, e-waste, other) and the app gives **Recovery Points**. Items pile into a pickup batch. At **100 points** the batch is *ready*, a pickup person collects it and delivers it to a recycler. **E-waste can only be delivered to a verified recycler.** The backend blocks everything else with a 403 error.

> Points are made-up demo values, not money.

## Repository

```
ewaste-app/
  backend/    Python API (FastAPI + SQLite + CLIP image model)
    app/      main.py, routes.py, classifier.py, scoring.py, db.py
    requirements.txt
  frontend/   Website (plain HTML, CSS and JavaScript, no framework)
  docs/
```

## Backend

- **FastAPI** serves the API, **SQLite** stores users, batches and items (`backend/ewaste.db`, created on first start, not in Git).
- **Image model:** CLIP (`openai/clip-vit-base-patch32`), used zero-shot. We did **not** train it. We only chose the 7 text labels it compares a photo with. The first start downloads about 600 MB.
- **Roles:** collector (scans), pickup, recycler.
- **Batch statuses:** collecting, ready, assigned, picked_up, delivered, completed.
- **Points per kg:** plastic 2, cardboard 1, paper 1, metal 10, glass 1, e-waste 50, other 0. Each scan uses a default weight per category, multiplied by the quantity.
- **Low confidence rule:** if the model is below 60% sure, `/scan` saves nothing and answers `needs_category: true`, so the app asks the user to choose the category.

| Endpoint | What it does |
|---|---|
| `GET /health` | Is the server alive |
| `POST /users` | Create a user (name, role) |
| `POST /scan` | Photo (`file`), `owner_id`, optional `category`, optional `quantity` |
| `GET /batches?owner_id=` | A user's batches |
| `GET /batches/ready` | Batches ready for pickup |
| `POST /batches/{id}/accept?pickup_id=` | Pickup person takes a batch |
| `POST /batches/{id}/picked-up` | Batch collected |
| `GET /recyclers` | Verified recyclers (`?include_unverified=true` shows all) |
| `POST /batches/{id}/deliver?recycler_id=` | Deliver. 403 if the batch has e-waste and the recycler is not verified |
| `POST /batches/{id}/confirm` | Recycler confirms, batch completed |

Demo users created on the first start: 1 collector (Asha), 2 verified recycler (GreenMetal Recyclers), 3 unverified recycler (QuickScrap Traders), 4 pickup (Ravi).

### Run the backend

```
cd backend
py -3.14 -m venv venv          (or: python -m venv venv)
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0
```

Open http://127.0.0.1:8000/docs to try every endpoint.

## Frontend

Pages: Home, AI Detection, Dashboard, **Pickup & Delivery**, Categories, About, Login, Sign up.

- **AI Detection** sends the photo to `POST /scan` and shows the category, the points and the pickup batch progress (for example 45 / 100 points). If the AI is not sure, it shows category buttons and sends the photo again with the chosen category.
- Photos come from file upload, drag and drop, the live camera, or **Take Photo** (opens the phone's camera app, works on plain http).
- **Pickup & Delivery** is a demo board that shows the batches and walks one through the whole flow: accept pickup (Ravi, user #4), picked up, deliver to a recycler, confirm. The recycler list shows the unverified recycler too, so the **403 e-waste rule can be shown on screen**.
- The **Dashboard** has a panel with batch counts and points from the server. Its other totals and the history are saved only in the browser.
- The page finds the backend at the **same address as the website, port 8000**. If the backend runs on another laptop, set its address on the Pickup & Delivery page (or open any page with `?api=http://IP:8000`).
- **Login is a demo only:** accounts are stored in the browser (`localStorage`), not on the server. **Continue as Demo User** skips signup. Every scan is saved in the backend as collector user 1.

### Run the frontend (same laptop as the backend)

```
cd frontend
python -m http.server 5500 --bind 0.0.0.0
```

Open http://127.0.0.1:5500/login.html on the laptop, or `http://<laptop-ip>:5500/login.html` on a phone on the same Wi-Fi or hotspot. Find the laptop IP with `ipconfig`.

## Known limits

- Tested the model on only about 11 photos, mostly clean ones. A keyboard or mouse photo was wrongly called cardboard (0.42 confidence), which is what the low confidence rule catches. Real accuracy is **not** measured.
- No real login on the backend: any user id can call any endpoint.
- "Verified recycler" is a flag in the database. There are no document checks.
- All frontend scans and the Pickup & Delivery board use the demo collector (#1) and the demo pickup person (#4). They are not real user accounts.
- The "100 points" limit is written in both `backend/app/routes.py` (`READY_LIMIT`) and `frontend/script.js` (`ECOTRACK_READY_POINTS`). Change both together.
- SQLite and local photo storage are for a demo, not for production.
