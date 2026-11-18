"""Compute road, signal, and transit estimates from the same incident snapshot."""

from collections import defaultdict
from itertools import count
from heapq import heappop, heappush
from math import ceil

from .network import JUNCTIONS, ROADS, SEVERITIES, STATIONS

ADJACENCY = defaultdict(list)
for road_id, road in ROADS.items():
    ADJACENCY[road["from"]].append((road["to"], road_id))
    ADJACENCY[road["to"]].append((road["from"], road_id))


def road_paths(origin, destination, delays, limit=3):
    """Find the lowest-cost simple paths over the small, bidirectional network."""
    tie_breaker = count()
    pending = [(0, next(tie_breaker), (origin,), ())]
    routes = []
    while pending and len(routes) < limit:
        minutes, _, nodes, links = heappop(pending)
        point = nodes[-1]
        if point == destination:
            km = sum(ROADS[link]["km"] for link in links)
            base = sum(ROADS[link]["minutes"] for link in links)
            names = [JUNCTIONS[node]["name"] for node in nodes[1:-1]]
            routes.append({
                "id": "/".join(links), "mode": "Drive",
                "name": f"Via {' · '.join(names)}" if names else ROADS[links[0]]["name"],
                "minutes": minutes, "base_minutes": base, "delay": minutes - base,
                "km": round(km, 1), "nodes": nodes, "links": links,
                "affected_links": [link for link in links if delays.get(link)],
            })
            continue
        for neighbor, link in ADJACENCY[point]:
            if neighbor in nodes:
                continue
            cost = ROADS[link]["minutes"] + delays.get(link, 0)
            heappush(pending, (minutes + cost, next(tie_breaker), (*nodes, neighbor), (*links, link)))
    return routes


def signal_estimate(junction, diversion):
    # Compare the modeled approach with the same 90-second signal cycle.
    cycle = 90
    demand = junction["demand"] + diversion
    baseline_green = junction["green"]
    adjusted_green = min(60, baseline_green + (12 if diversion else 8))

    def timing(green):
        capacity = round(1800 * green / cycle)
        red = cycle - green
        red_delay = red ** 2 / (2 * cycle)
        overflow = max(0, demand - capacity) / 4
        return {"green": green, "red": red, "capacity": capacity, "delay": round(red_delay + overflow)}

    fixed = timing(baseline_green)
    adjusted = timing(adjusted_green)
    return {
        "demand": demand, "diversion": diversion, "cycle": cycle, "fixed": fixed,
        "adjusted": adjusted, "saved_seconds": fixed["delay"] - adjusted["delay"],
    }


def transit_options(origin, destination, road_route, baseline_road):
    bus = {
        "id": "bus", "mode": "Bus", "name": "BMTC bus",
        "minutes": ceil(road_route["minutes"] * 1.2) + 8,
        "detail": "8 min for walking and waiting · uses the fastest modeled road corridor",
        "links": road_route["links"], "nodes": road_route["nodes"],
        "delay": ceil(road_route["minutes"] * 1.2) - ceil(baseline_road["minutes"] * 1.2),
    }
    if origin not in STATIONS or destination not in STATIONS:
        return [bus]
    # Station offsets represent modeled ride times in the eastbound direction.
    ride = abs(STATIONS[origin] - STATIONS[destination])
    low, high = sorted((STATIONS[origin], STATIONS[destination]))
    stations = [node for node, offset in STATIONS.items() if low <= offset <= high]
    if origin != stations[0]:
        stations.reverse()
    metro = {
        "id": "metro", "mode": "Metro", "name": "Namma Metro · Purple Line",
        "minutes": ride + 8, "delay": 0, "links": (), "nodes": stations,
        "detail": f"{ride} min ride + 8 min walking and waiting · rail bypasses road incidents",
    }
    return [metro, bus]


def scenario(origin, destination, incidents):
    delays = {row["road_id"]: SEVERITIES[row["severity"]][0] for row in incidents}
    diversion = defaultdict(int)
    for row in incidents:
        road = ROADS[row["road_id"]]
        for endpoint in (road["from"], road["to"]):
            diversion[endpoint] += SEVERITIES[row["severity"]][1]

    routes = road_paths(origin, destination, delays)
    baseline_road = road_paths(origin, destination, {}, limit=1)[0] if delays else routes[0]
    if all(option["id"] != baseline_road["id"] for option in routes):
        # Keep the original corridor visible when delays push it out of the top three.
        incident_delay = sum(delays.get(link, 0) for link in baseline_road["links"])
        routes[-1] = {
            **baseline_road, "minutes": baseline_road["minutes"] + incident_delay,
            "delay": incident_delay, "affected_links": [link for link in baseline_road["links"] if link in delays],
        }
    fastest_road = routes[0]
    transit = transit_options(origin, destination, fastest_road, baseline_road)
    ranked = sorted([fastest_road, *transit], key=lambda option: option["minutes"])
    best = ranked[0]
    margin = ranked[1]["minutes"] - best["minutes"]
    if margin == 0:
        reason = f"{best['name']} ties the next option in this simulation."
    elif best["mode"] == "Metro" and delays:
        reason = f"The Purple Line bypasses road incidents and is {margin} min quicker than the next option."
    else:
        reason = f"{best['name']} is {margin} min quicker than the next option using current simulation estimates."
    return {
        "junctions": JUNCTIONS,
        "roads": {key: {**road, "delay": delays.get(key, 0)} for key, road in ROADS.items()},
        "signals": {key: signal_estimate(junction, diversion[key]) for key, junction in JUNCTIONS.items()},
        "routes": routes, "transit": transit, "incidents": incidents,
        "recommendation": {**best, "reason": reason, "minutes_ahead": margin},
    }
