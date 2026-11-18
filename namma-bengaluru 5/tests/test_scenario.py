import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.network import JUNCTIONS, ROADS


class ScenarioTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / "traffic.sqlite3"
        client = TestClient(create_app(self.path))
        self.client = client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)

    def scenario(self, **journey):
        response = self.client.get("/api/scenario", params=journey)
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_baseline_disruption_and_resolution(self):
        before = self.scenario()
        self.assertEqual((before["recommendation"]["mode"], before["recommendation"]["minutes"]), ("Drive", 25))
        self.assertEqual(before["signals"]["kr-puram"]["demand"], 1000)
        self.assertEqual([item["minutes"] for item in before["transit"]], [28, 38])

        incident = self.client.post("/api/incidents/demo")
        self.assertEqual(incident.status_code, 200)
        repeated = self.client.post("/api/incidents/demo")
        self.assertEqual(repeated.json()["id"], incident.json()["id"])
        after = self.scenario()

        self.assertEqual(len(after["incidents"]), 1)
        self.assertEqual(after["roads"]["kr-hoodi"]["delay"], 16)
        self.assertEqual(after["routes"][0]["minutes"], 32)
        original = next(route for route in after["routes"] if route["id"] == before["routes"][0]["id"])
        self.assertEqual((original["minutes"], original["delay"]), (41, 16))
        self.assertEqual(after["signals"]["kr-puram"]["demand"], 1250)
        self.assertGreater(after["signals"]["kr-puram"]["saved_seconds"], before["signals"]["kr-puram"]["saved_seconds"])
        self.assertEqual([item["minutes"] for item in after["transit"]], [28, 47])
        self.assertEqual((after["recommendation"]["mode"], after["recommendation"]["minutes"]), ("Metro", 28))

        response = self.client.delete(f"/api/incidents/{incident.json()['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.scenario(), before)

    def test_all_journey_pairs_are_connected_and_costs_are_consistent(self):
        for origin in JUNCTIONS:
            for destination in JUNCTIONS:
                if origin == destination:
                    continue
                with self.subTest(origin=origin, destination=destination):
                    data = self.scenario(origin=origin, destination=destination)
                    for route in data["routes"]:
                        self.assertEqual([route["nodes"][0], route["nodes"][-1]], [origin, destination])
                        self.assertEqual(len(route["nodes"]), len(set(route["nodes"])))
                        self.assertEqual(route["minutes"], sum(ROADS[link]["minutes"] for link in route["links"]))
                    options = [*data["routes"], *data["transit"]]
                    self.assertEqual(data["recommendation"]["minutes"], min(option["minutes"] for option in options))

    def test_invalid_inputs_duplicates_and_missing_incidents(self):
        self.assertEqual(self.client.get("/api/scenario?origin=none").status_code, 422)
        self.assertEqual(self.client.get("/api/scenario?destination=indiranagar").status_code, 422)
        self.assertEqual(self.client.get("/api/not-an-endpoint").status_code, 404)
        self.assertEqual(self.client.delete("/api/incidents/300").status_code, 404)
        invalid = {"road_id": "none", "kind": "Collision", "severity": "Medium"}
        self.assertEqual(self.client.post("/api/incidents", json=invalid).status_code, 422)
        payload = {**invalid, "road_id": "kr-hoodi"}
        self.assertEqual(self.client.post("/api/incidents", json={**payload, "severity": "Extreme"}).status_code, 422)
        self.assertEqual(self.client.post("/api/incidents", json=payload).status_code, 201)
        self.assertEqual(self.client.post("/api/incidents", json=payload).status_code, 409)
        self.assertEqual(self.client.post("/api/incidents/demo").status_code, 409)

    def test_concurrent_reports_and_persistence(self):
        payload = {"road_id": "hal", "kind": "Waterlogging", "severity": "Medium"}
        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(
                lambda _: self.client.post("/api/incidents", json=payload).status_code, range(2)
            ))
        self.assertCountEqual(statuses, [201, 409])
        with TestClient(create_app(self.path)) as restarted:
            data = restarted.get("/api/scenario?origin=old-airport").json()
            self.assertEqual(len(data["incidents"]), 1)
            self.assertEqual(data["roads"]["hal"]["delay"], 10)
            self.assertEqual([option["mode"] for option in data["transit"]], ["Bus"])

    def test_signal_timings_use_a_fixed_cycle(self):
        for signal in self.scenario()["signals"].values():
            for timing in [signal["fixed"], signal["adjusted"]]:
                self.assertEqual(timing["green"] + timing["red"], signal["cycle"])
                self.assertGreaterEqual(timing["delay"], 0)
            self.assertEqual(signal["fixed"]["delay"] - signal["adjusted"]["delay"], signal["saved_seconds"])


if __name__ == "__main__":
    unittest.main()
