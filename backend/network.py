"""Synthetic east Bengaluru corridor for a repeatable, offline simulation."""

JUNCTIONS = {
    "indiranagar": {"name": "Indiranagar", "x": 144, "y": 268, "demand": 650, "green": 39},
    "baiyappanahalli": {"name": "Baiyappanahalli", "x": 245, "y": 155, "demand": 570, "green": 34},
    "old-airport": {"name": "HAL Airport Road", "x": 295, "y": 340, "demand": 790, "green": 43},
    "kr-puram": {"name": "KR Puram", "x": 420, "y": 119, "demand": 1000, "green": 38},
    "marathahalli": {"name": "Marathahalli", "x": 508, "y": 324, "demand": 970, "green": 44},
    "hoodi": {"name": "Hoodi", "x": 599, "y": 166, "demand": 710, "green": 36},
    "whitefield": {"name": "Whitefield", "x": 711, "y": 125, "demand": 730, "green": 40},
}

# id, road name, endpoints, distance in km, typical minutes, map bends
ROAD_DATA = [
    ("100ft", "100 Feet Road", "indiranagar", "baiyappanahalli", 2.1, 5, [[166, 236], [175, 185]]),
    ("old-madras", "Old Madras Road", "baiyappanahalli", "kr-puram", 3.0, 6, [[312, 149], [364, 128]]),
    ("kr-hoodi", "KR Puram Main Road", "kr-puram", "hoodi", 4.0, 8, [[468, 130], [531, 140]]),
    ("hoodi-whitefield", "Whitefield Main Road", "hoodi", "whitefield", 2.9, 6, [[635, 158], [669, 132]]),
    ("hal", "Old Airport Road", "indiranagar", "old-airport", 3.2, 8, [[157, 300], [225, 324]]),
    ("hal-marathahalli", "HAL–Marathahalli Road", "old-airport", "marathahalli", 3.6, 9, [[360, 345], [426, 333]]),
    ("kundalahalli", "Kundalahalli Main Road", "marathahalli", "whitefield", 5.4, 15, [[567, 303], [620, 278], [664, 216], [688, 174]]),
    ("outer-ring", "Outer Ring Road", "kr-puram", "marathahalli", 5.1, 13, [[443, 174], [446, 226], [478, 280]]),
    ("hoodi-cross", "Hoodi Main Road", "marathahalli", "hoodi", 4.0, 12, [[548, 276], [570, 223]]),
]

ROADS = {
    road_id: {"name": name, "from": start, "to": end, "km": km, "minutes": minutes, "bends": bends}
    for road_id, name, start, end, km, minutes, bends in ROAD_DATA
}

DEMO = {
    "road_id": "kr-hoodi", "kind": "Lane closure", "severity": "High",
    "description": "A simulated lane closure reduces capacity on the KR Puram to Hoodi corridor.",
}

SEVERITIES = {"Low": (5, 60), "Medium": (10, 135), "High": (16, 250)}
INCIDENT_TYPES = ("Lane closure", "Collision", "Roadworks", "Waterlogging")
STATIONS = {"indiranagar": 0, "baiyappanahalli": 4, "kr-puram": 9, "hoodi": 15, "whitefield": 20}
