# Namma Bengaluru

Namma Bengaluru is a full-stack traffic simulation for an east Bengaluru corridor. Test how a lane closure or another disruption changes signal timing, driving routes, bus estimates, and the recommended journey.

The dashboard uses seven modeled junctions and nine road links. It runs locally with synthetic traffic data, a schematic map, and simulated transit times.

## Run the dashboard

From the project root, use Python 3.9 or newer and Node.js 22 or newer.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
python -m uvicorn backend.main:app --port 8000
```

Open [the dashboard](http://127.0.0.1:8000/) or [the interactive API docs](http://127.0.0.1:8000/docs). On Windows PowerShell, activate the virtual environment with `.venv\Scripts\Activate.ps1`.

For React hot reload, keep FastAPI on port 8000 and run `npm --prefix frontend run dev` in another terminal. Vite proxies `/api` calls to FastAPI.

## Workspaces

Use the navigation bar to open a dedicated workspace. **Overview** contains the network map, journey planner, and recommendation. **Signals**, **Routes**, **Incidents**, and **Public transport** each pair their own controls and results with the corridor map. The workspaces share the current journey and incident data. You can bookmark each workspace and use your browser’s Back and Forward buttons.

## Live demonstration

Use a fresh database for a clean starting scenario. The default journey is Indiranagar to Whitefield.

| What to show | Baseline | KR Puram Main Road closure |
| --- | --- | --- |
| Incident management | 0 incidents | 1 high-severity lane closure |
| Signal comparison, KR Puram | 1,000 vehicles per hour | 1,250 vehicles per hour |
| Original road route | 25 min | 41 min |
| Fastest road alternative | 25 min | 32 min via HAL Airport Road and Marathahalli |
| Public transport | Metro 28 min, bus 38 min | Metro 28 min, bus 47 min |
| Recommended journey | Drive, 25 min | Purple Line metro, 28 min |

1. Open the dashboard and point out the 25-minute drive and the corridor highlighted on the map.
2. Click **Run incident demo**. The dashboard marks the affected road, highlights the Purple Line, and recommends the 28-minute metro trip.
3. Open **Signals** to compare the fixed and adjusted timing at KR Puram. Open **Routes** to show the 16-minute delay on the original road route, then **Incidents** to show the reported closure.
4. Open **Public transport** and expand **Simulation assumptions**. Explain that the metro bypasses the road incident and beats the best driving alternative by four minutes.
5. Return to **Overview** and click **Resolve demo incident** to show the baseline recommendation returning.

## Architecture and assumptions

- **React and Vite** render the dashboard and interactive schematic map. The browser receives a single scenario snapshot after every change.
- **FastAPI** validates junctions and incidents. `GET /api/scenario` returns the network, active incidents, signal estimates, routes, transit options, and recommendation together.
- **SQLite** persists incident reports and resolutions. One incident can be active per road. Set `NAMMA_DB_PATH` to use a separate database file.
- **Driving** ranks up to three distinct bidirectional paths by time, keeping the fastest undisturbed corridor visible for comparison. Low, medium, and high severity add 5, 10, or 16 minutes to an affected link.
- **Signals** compare fixed and adjusted green time within a 90-second cycle using modeled demand, capacity, and red time. The comparison covers one approach per junction. Each incident adds 60, 135, or 250 vehicles per hour to each endpoint depending on severity.
- **Bus** uses the fastest current road corridor with a 20% time adjustment rounded up, plus eight minutes for access and waiting. **Metro** uses modeled Purple Line station-to-station times and the same eight-minute allowance when both endpoints have modeled stations.
- **The decision engine** picks the shortest estimated duration among driving, bus, and metro. Ties use the displayed mode order, starting with driving. The signal-delay comparison is independent of the link travel-time estimates.

The road geometry, demand, capacity, and transit times are classroom demonstration values. The app uses no live feeds and has no connection to physical traffic signals.

## Verify

```bash
python -m unittest discover -s tests -v
npm --prefix frontend run build
```

The test suite covers incident activation and resolution, all 42 distinct origin–destination pairs, invalid inputs, concurrent reports, database persistence, and signal cycle consistency. GitHub Actions runs the suite and frontend build.

The map-first layout, responsive controls, reduced-motion support, and action feedback follow the frontend design fidelity, cinematic UI motion, and curiosity-driven UX guidance in the [Prats Skill Atlas README](https://github.com/peterish8/prats-skill-atlas#readme).
