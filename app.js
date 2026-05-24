const stations = Array.isArray(window.HEATWAVE_DATA) ? window.HEATWAVE_DATA : [];
const ALL_STATIONS_ID = "all";

const stationSelect = document.querySelector("#station-select");
const stationSummary = document.querySelector("#station-summary");
const tableBody = document.querySelector("#heatwave-body");
const emptyState = document.querySelector("#empty-state");
const sortStatus = document.querySelector("#sort-status");
const sortButtons = Array.from(document.querySelectorAll(".sort-button"));
const stationColHeader = document.querySelector(".col-station");
const periodsButton = document.querySelector("#periods-button");
const currentButton = document.querySelector("#current-button");
const monthFilter = document.querySelector("#month-filter");
const yearFilter = document.querySelector("#year-filter");
const heatwaveTable = document.querySelector("#heatwave-table");

const columnLabels = {
  stationLabel: "station",
  startDate: "begindatum",
  endDate: "einddatum",
  dayCount: "aantal dagen",
  heatwaveScore: "hittegolfgetal",
  heatwaveScorePerDay: "hittegolfgetal per dag",
  averageTemperature: "gemiddelde temperatuur",
  maxTemperature: "maximumtemperatuur",
  hasThreeThirtyPlusDays: "30+ indicator",
  warmestPeriodAvgTemp: "warmste periode (gem. temperatuur)",
  warmestPeriodDayCount: "aantal dagen warmste periode",
  warmestPeriodStartDate: "begin warmste periode",
  warmestPeriodEndDate: "eind warmste periode",
};

const state = {
  stationId: stations[0]?.stationId ?? null,
  sortKey: "startDate",
  sortDirection: "asc",
  viewMode: "periods",
  month: "all",
  year: "all",
};

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}

function formatTemperature(value) {
  return `${value.toFixed(1).replace(".", ",")} °C`;
}

function formatScore(value) {
  return value.toFixed(1).replace(".", ",");
}

function isAllStations() {
  return state.stationId === ALL_STATIONS_ID;
}

function getSelectedStation() {
  if (isAllStations()) return null;
  return stations.find((station) => station.stationId === state.stationId) ?? null;
}

function getAllHeatwaves() {
  return stations.flatMap((station) =>
    station.heatwaves.map((heatwave) => ({ ...heatwave, stationLabel: station.stationLabel }))
  );
}

function getAllCurrentRows() {
  return stations
    .map((station) => {
      const current = station.currentPeriod;
      if (!current) {
        return null;
      }
      return {
        stationLabel: station.stationLabel,
        ...current,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
}

function parseMonth(dateText) {
  return Number(dateText.slice(5, 7));
}

function parseYear(dateText) {
  return Number(dateText.slice(0, 4));
}

function getBaseHeatwaves() {
  if (isAllStations()) {
    return getAllHeatwaves();
  }
  return getSelectedStation()?.heatwaves ?? [];
}

function applyDateFilters(heatwaves) {
  return heatwaves.filter((item) => {
    if (state.month !== "all" && parseMonth(item.startDate) !== Number(state.month)) {
      return false;
    }
    if (state.year !== "all" && parseYear(item.startDate) !== Number(state.year)) {
      return false;
    }
    return true;
  });
}

function refreshYearOptions() {
  const years = [...new Set(getBaseHeatwaves().map((item) => parseYear(item.startDate)))].sort((a, b) => a - b);
  const previous = state.year;

  yearFilter.innerHTML = `<option value="all">Alle jaren</option>${years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("")}`;

  if (previous !== "all" && years.includes(Number(previous))) {
    yearFilter.value = previous;
    state.year = previous;
  } else {
    yearFilter.value = "all";
    state.year = "all";
  }
}

function getSortedHeatwaves(heatwaves) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...heatwaves].sort((left, right) => {
    const a = left[state.sortKey];
    const b = right[state.sortKey];

    if (typeof a === "boolean" && typeof b === "boolean") {
      return ((a === b ? 0 : a ? 1 : -1) * direction);
    }

    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }

    return String(a).localeCompare(String(b)) * direction;
  });
}

function renderSummary(station) {
  if (state.viewMode === "current") {
    const newestDate = stations
      .map((s) => s.latestDate)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0];

    if (isAllStations()) {
      const rows = getAllCurrentRows();
      const dateText = newestDate ? formatDate(newestDate) : "onbekend";
      stationSummary.innerHTML = `<strong>Alle stations</strong><br>${rows.length} huidige periodes zonder 5-dagen eis. Nieuwste dag in dataset: ${dateText}.`;
      return;
    }

    if (!station) {
      stationSummary.textContent = "Geen station geselecteerd.";
      return;
    }

    const current = station.currentPeriod;
    const dateText = station.latestDate ? formatDate(station.latestDate) : "onbekend";
    stationSummary.innerHTML = current
      ? `<strong>${station.stationLabel}</strong><br>Huidige periode zonder 5-dagen eis. Nieuwste dag in dataset: ${dateText}.`
      : `<strong>${station.stationLabel}</strong><br>Geen huidige periode (nieuwste dag in dataset: ${dateText}).`;
    return;
  }

  if (isAllStations()) {
    const total = applyDateFilters(getAllHeatwaves()).length;
    stationSummary.innerHTML = `<strong>Alle stations</strong><br>${total} periodes over ${stations.length} stations.`;
    return;
  }
  if (!station) {
    stationSummary.textContent = "Geen station geselecteerd.";
    return;
  }

  const longestHeatwave = station.heatwaves.reduce(
    (current, heatwave) => (heatwave.dayCount > current.dayCount ? heatwave : current),
    station.heatwaves[0] ?? { dayCount: 0 }
  );

  const filtered = applyDateFilters(station.heatwaves);
  stationSummary.innerHTML = filtered.length
    ? `<strong>${station.stationLabel}</strong><br>${filtered.length} periodes gevonden. Langste periode: ${longestHeatwave.dayCount} dagen.`
    : `<strong>${station.stationLabel}</strong><br>Geen periodes van minimaal vijf dagen met een maximumtemperatuur vanaf 25 °C.`;
}

function heatwaveRow(heatwave, showStation) {
  const stationCell = showStation ? `<td>${heatwave.stationLabel}</td>` : "";
  return `
    <tr>
      ${stationCell}
      <td>${formatDate(heatwave.startDate)}</td>
      <td>${formatDate(heatwave.endDate)}</td>
      <td>${heatwave.dayCount}</td>
      <td>${formatScore(heatwave.heatwaveScore)}</td>
      <td>${formatScore(heatwave.heatwaveScorePerDay)}</td>
      <td>${formatTemperature(heatwave.averageTemperature)}</td>
      <td>${formatTemperature(heatwave.maxTemperature)}</td>
      <td><span class="boolean-pill ${heatwave.hasThreeThirtyPlusDays ? "yes" : "no"}">${heatwave.hasThreeThirtyPlusDays ? "Ja" : "Nee"}</span></td>
      <td>${formatTemperature(heatwave.warmestPeriodAvgTemp)}</td>
      <td>${heatwave.warmestPeriodDayCount}</td>
      <td>${formatDate(heatwave.warmestPeriodStartDate)}</td>
      <td>${formatDate(heatwave.warmestPeriodEndDate)}</td>
    </tr>`;
}

function renderTable() {
  const showCurrent = state.viewMode === "current";
  heatwaveTable.hidden = false;
  monthFilter.disabled = showCurrent;
  yearFilter.disabled = showCurrent;

  const showStation = isAllStations();
  stationColHeader.hidden = !showStation;

  const station = getSelectedStation();
  renderSummary(station);

  if (showCurrent) {
    const rows = showStation
      ? getAllCurrentRows()
      : (station?.currentPeriod ? [{ ...station.currentPeriod, stationLabel: station.stationLabel }] : []);

    if (rows.length === 0) {
      tableBody.innerHTML = "";
      emptyState.hidden = false;
      sortStatus.textContent = "Geen huidige periodes beschikbaar.";
      return;
    }

    emptyState.hidden = true;
    tableBody.innerHTML = getSortedHeatwaves(rows).map((row) => heatwaveRow(row, showStation)).join("");
    const newestDate = stations
      .map((s) => s.latestDate)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0];
    const newestText = newestDate ? formatDate(newestDate) : "onbekend";
    sortStatus.textContent = `Weergave: huidig (nieuwste dag in dataset: ${newestText}).`;
    return;
  }

  const heatwaves = showStation
    ? getAllHeatwaves()
    : station?.heatwaves ?? [];
  const filteredHeatwaves = applyDateFilters(heatwaves);

  if (filteredHeatwaves.length === 0) {
    tableBody.innerHTML = "";
    emptyState.hidden = false;
    sortStatus.textContent = "Geen periodes om te sorteren.";
    return;
  }

  emptyState.hidden = true;
  tableBody.innerHTML = getSortedHeatwaves(filteredHeatwaves).map((h) => heatwaveRow(h, showStation)).join("");
  sortStatus.textContent = `Gesorteerd op ${columnLabels[state.sortKey]} (${state.sortDirection === "asc" ? "oplopend" : "aflopend"}).`;
}

function updateModeButtons() {
  periodsButton.classList.toggle("active", state.viewMode === "periods");
  currentButton.classList.toggle("active", state.viewMode === "current");
}

function updateSortButtons() {
  for (const button of sortButtons) {
    const isActive = button.dataset.key === state.sortKey;
    button.classList.toggle("active", isActive);
    button.dataset.direction = isActive ? state.sortDirection : "";
    button.setAttribute("aria-sort", isActive ? state.sortDirection : "none");
  }
}

function populateStationSelect() {
  const allOption = `<option value="${ALL_STATIONS_ID}">— Alle stations —</option>`;
  const stationOptions = stations
    .map(
      (station) =>
        `<option value="${station.stationId}">${station.stationLabel} (${station.heatwaves.length})</option>`
    )
    .join("");
  stationSelect.innerHTML = allOption + stationOptions;

  if (state.stationId !== null) {
    stationSelect.value = String(state.stationId);
  }
}

stationSelect.addEventListener("change", (event) => {
  const raw = event.target.value;
  state.stationId = raw === ALL_STATIONS_ID ? ALL_STATIONS_ID : Number(raw);
  refreshYearOptions();
  renderTable();
});

monthFilter.addEventListener("change", (event) => {
  state.month = event.target.value;
  renderTable();
});

yearFilter.addEventListener("change", (event) => {
  state.year = event.target.value;
  renderTable();
});

periodsButton.addEventListener("click", () => {
  state.viewMode = "periods";
  updateModeButtons();
  renderTable();
});

currentButton.addEventListener("click", () => {
  state.viewMode = "current";
  updateModeButtons();
  renderTable();
});

for (const button of sortButtons) {
  button.addEventListener("click", () => {
    if (state.sortKey === button.dataset.key) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = button.dataset.key;
      state.sortDirection = button.dataset.key === "startDate" || button.dataset.key === "endDate" ? "asc" : "desc";
    }

    updateSortButtons();
    renderTable();
  });
}

populateStationSelect();
refreshYearOptions();
updateSortButtons();
updateModeButtons();
renderTable();