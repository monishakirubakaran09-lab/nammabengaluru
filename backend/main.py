"""FastAPI entry point and persistent incident log."""

from contextlib import asynccontextmanager, closing, contextmanager
import os
from pathlib import Path
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .engine import scenario
from .network import DEMO, JUNCTIONS, ROADS

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def database(path):
    with closing(sqlite3.connect(path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        yield connection


class IncidentInput(BaseModel):
    road_id: str
    kind: Literal["Lane closure", "Collision", "Roadworks", "Waterlogging"]
    severity: Literal["Low", "Medium", "High"]
    description: str = Field(default="", max_length=240)

    @field_validator("road_id")
    @classmethod
    def known_road(cls, value):
        if value not in ROADS:
            raise ValueError("Choose a road in the simulation.")
        return value


def create_app(db_path=None):
    path = db_path or os.getenv("NAMMA_DB_PATH", str(ROOT / "backend" / "traffic.sqlite3"))

    @asynccontextmanager
    async def lifespan(app):
        with database(path) as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY,
                    road_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TEXT
                );
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_incident_per_road
                    ON incidents(road_id) WHERE resolved_at IS NULL;
            """)
        yield

    app = FastAPI(title="Namma Bengaluru", version="1.0.0", lifespan=lifespan)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "data": "simulated"}

    @app.get("/api/scenario")
    def read_scenario(origin: str = "indiranagar", destination: str = "whitefield"):
        if origin not in JUNCTIONS or destination not in JUNCTIONS:
            raise HTTPException(422, "Choose junctions shown on the simulation map.")
        if origin == destination:
            raise HTTPException(422, "Choose different start and end junctions.")
        with database(path) as connection:
            incidents = connection.execute(
                "SELECT * FROM incidents WHERE resolved_at IS NULL ORDER BY id DESC"
            ).fetchall()
        return scenario(origin, destination, [dict(row) for row in incidents])

    @app.post("/api/incidents", status_code=201)
    def create_incident(payload: IncidentInput):
        values = payload.model_dump()
        try:
            with database(path) as connection:
                cursor = connection.execute("""
                    INSERT INTO incidents (road_id, kind, severity, description)
                    VALUES (:road_id, :kind, :severity, :description)
                """, values)
                return dict(connection.execute("SELECT * FROM incidents WHERE id = ?", (cursor.lastrowid,)).fetchone())
        except sqlite3.IntegrityError as error:
            raise HTTPException(409, "This road already has an active incident. Resolve it first.") from error

    @app.post("/api/incidents/demo")
    def activate_demo():
        with database(path) as connection:
            connection.execute("""
                INSERT OR IGNORE INTO incidents (road_id, kind, severity, description)
                VALUES (:road_id, :kind, :severity, :description)
            """, DEMO)
            incident = dict(connection.execute(
                "SELECT * FROM incidents WHERE road_id = ? AND resolved_at IS NULL", (DEMO["road_id"],)
            ).fetchone())
            if any(incident[key] != value for key, value in DEMO.items()):
                raise HTTPException(409, "Resolve the existing KR Puram Main Road incident before running this demo.")
            return incident

    @app.delete("/api/incidents/{incident_id}")
    def resolve_incident(incident_id: int):
        with database(path) as connection:
            cursor = connection.execute(
                "UPDATE incidents SET resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND resolved_at IS NULL",
                (incident_id,),
            )
            if cursor.rowcount == 0:
                raise HTTPException(404, "This active incident could not be found.")
        return {"resolved": True}

    @app.api_route("/api/{unknown:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def unknown_api(unknown: str):
        raise HTTPException(404, "API endpoint not found.")

    public = ROOT / "frontend" / "dist"
    if public.is_dir():
        app.mount("/", StaticFiles(directory=public, html=True), name="frontend")
    return app


app = create_app()
