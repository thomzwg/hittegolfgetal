from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

DATA_DIR = Path("stationsdata")
OUTPUT_PATH = Path("heatwaves-data.js")
MIN_TX = 25.0
HOT_TX = 30.0
MIN_LENGTH = 5
RECENT_VALUES_COUNT = 30

STATION_NAMES: dict[int, str] = {
    209: "IJmond",
    210: "Valkenburg Vk",
    215: "Voorschoten",
    225: "IJmuiden",
    235: "De Kooy Airport",
    240: "Schiphol Airport",
    242: "Vlieland Vliehors",
    248: "Wijdenes",
    249: "Berkhout",
    251: "Hoorn Terschelling",
    257: "Wijk aan Zee",
    258: "Houtribdijk",
    260: "De Bilt",
    265: "Soesterberg",
    267: "Stavoren",
    269: "Lelystad Airport",
    270: "Leeuwarden Airport",
    273: "Marknesse",
    275: "Deelen Airport",
    277: "Lauwersoog",
    278: "Heino",
    279: "Hoogeveen",
    280: "Groningen Airport Eelde",
    283: "Hupsel",
    285: "Huibertgat",
    286: "Nieuw Beerta",
    290: "Twenthe Airport",
    308: "Cadzand",
    310: "Vlissingen",
    311: "Hoofdplaat",
    312: "Oosterschelde",
    313: "Vlakte van De Raan",
    315: "Hansweert",
    316: "Schaar",
    319: "Westdorpe",
    323: "Wilhelminadorp",
    324: "Stavenisse",
    330: "Hoek van Holland",
    331: "Tholen",
    340: "Woensdrecht Airport",
    343: "Rotterdam Geulhaven",
    344: "Rotterdam Airport",
    348: "Cabauw",
    350: "Gilze-Rijen Airport",
    356: "Herwijnen",
    370: "Eindhoven Airport",
    375: "Volkel",
    377: "Ell",
    380: "Maastricht Airport",
    391: "Arcen",
}


@dataclass
class DayRecord:
    date: str
    average_temperature: float
    max_temperature: float


def read_station_rows(path: Path) -> tuple[int, list[DayRecord]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header_line = next(line for line in lines if line.startswith("# STN,"))
    headers = [field.strip() for field in header_line[2:].split(",")]
    station_rows: list[DayRecord] = []

    for raw_line in lines[lines.index(header_line) + 1 :]:
        if not raw_line.strip():
            continue

        values = next(csv.reader([raw_line], skipinitialspace=True))
        if len(values) != len(headers):
            continue

        row = dict(zip(headers, (value.strip() for value in values)))
        if not row["YYYYMMDD"] or not row["TX"] or not row["TG"]:
            continue

        station_rows.append(
            DayRecord(
                date=datetime.strptime(row["YYYYMMDD"], "%Y%m%d").date().isoformat(),
                average_temperature=int(row["TG"]) / 10,
                max_temperature=int(row["TX"]) / 10,
            )
        )

    station_id = int(path.stem.split("_")[-1])
    return station_id, station_rows


def warmest_subperiod(records: list[DayRecord], min_days: int = MIN_LENGTH) -> tuple[str, str, float]:
    n = len(records)
    prefix = [0.0] * (n + 1)
    for i, r in enumerate(records):
        prefix[i + 1] = prefix[i] + r.average_temperature

    required_days = min(min_days, n)
    best_avg = float("-inf")
    best_start = records[0].date
    best_end = records[required_days - 1].date

    for i in range(n):
        for j in range(i + required_days, n + 1):  # j is exclusive end index
            avg = (prefix[j] - prefix[i]) / (j - i)
            if avg > best_avg:
                best_avg = avg
                best_start = records[i].date
                best_end = records[j - 1].date

    return best_start, best_end, round(best_avg, 1)


def summarize_period(records: list[DayRecord], warmest_min_days: int = MIN_LENGTH) -> dict[str, object]:
    average_temperatures = [record.average_temperature for record in records]
    max_temperatures = [record.max_temperature for record in records]
    hot_days = sum(1 for value in max_temperatures if value >= HOT_TX)
    best5_start, best5_end, best5_avg = warmest_subperiod(records, min_days=warmest_min_days)
    best5_days = (datetime.strptime(best5_end, "%Y-%m-%d").date() - datetime.strptime(best5_start, "%Y-%m-%d").date()).days + 1
    day_count = len(records)
    heatwave_score = round(sum(value - MIN_TX for value in max_temperatures), 1)

    return {
        "startDate": records[0].date,
        "endDate": records[-1].date,
        "dayCount": day_count,
        "heatwaveScore": heatwave_score,
        "heatwaveScorePerDay": round(heatwave_score / day_count, 2),
        "averageTemperature": round(sum(average_temperatures) / len(average_temperatures), 1),
        "maxTemperature": round(max(max_temperatures), 1),
        "hasThreeThirtyPlusDays": hot_days >= 3,
        "warmestPeriodAvgTemp": best5_avg,
        "warmestPeriodStartDate": best5_start,
        "warmestPeriodEndDate": best5_end,
        "warmestPeriodDayCount": best5_days,
    }


def extract_heatwaves(records: list[DayRecord]) -> list[dict[str, object]]:
    heatwaves: list[dict[str, object]] = []
    current_period: list[DayRecord] = []

    for record in records:
        if record.max_temperature >= MIN_TX:
            current_period.append(record)
            continue

        if len(current_period) >= MIN_LENGTH:
            heatwaves.append(summarize_period(current_period))
        current_period = []

    if len(current_period) >= MIN_LENGTH:
        heatwaves.append(summarize_period(current_period))

    return heatwaves


def extract_current_period(records: list[DayRecord]) -> dict[str, object] | None:
    if not records:
        return None

    if records[-1].max_temperature < MIN_TX:
        return None

    current_period: list[DayRecord] = []
    for record in reversed(records):
        if record.max_temperature >= MIN_TX:
            current_period.append(record)
        else:
            break

    current_period.reverse()
    if not current_period:
        return None

    # For a current period we allow any length and compute warmest subperiod from 1 day onward.
    return summarize_period(current_period, warmest_min_days=1)


def build_dataset() -> list[dict[str, object]]:
    stations: list[dict[str, object]] = []

    for path in sorted(DATA_DIR.glob("etmgeg_*.txt")):
        station_id, records = read_station_rows(path)
        name = STATION_NAMES.get(station_id, f"Station {station_id}")
        synop_id = f"06{station_id}"
        label = f"{name} ({synop_id})"
        stations.append(
            {
                "stationId": station_id,
                "stationLabel": label,
                "heatwaves": extract_heatwaves(records),
                "currentPeriod": extract_current_period(records),
                "latestDate": records[-1].date if records else None,
                "recentValues": [
                    {
                        "date": record.date,
                        "averageTemperature": record.average_temperature,
                        "maxTemperature": record.max_temperature,
                    }
                    for record in records[-RECENT_VALUES_COUNT:]
                ],
            }
        )

    return stations


def write_output(stations: list[dict[str, object]]) -> None:
    payload = json.dumps(stations, ensure_ascii=True, separators=(",", ":"))
    OUTPUT_PATH.write_text(
        "window.HEATWAVE_DATA = " + payload + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    stations = build_dataset()
    write_output(stations)
    print(f"Generated {OUTPUT_PATH} for {len(stations)} stations.")


if __name__ == "__main__":
    main()