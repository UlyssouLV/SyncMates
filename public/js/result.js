/**
 * Script frontend de la page result.
 *
 * Ce fichier:
 * - lit syncerId depuis l'URL,
 * - appelle l'API /api/syncers/{id}/results,
 * - rend les informations du Syncer, le top des dates et le détail journalier.
 */

/**
 * Lit un paramètre de l'URL.
 *
 * @param {string} key Nom du paramètre.
 * @returns {string} Valeur trouvée ou chaîne vide.
 */
function getQueryParam(key) {
  const url = new URL(window.location.href);
  return String(url.searchParams.get(key) || "");
}

/**
 * Met à jour le texte d'un élément par son id.
 *
 * @param {string} elementId Identifiant HTML.
 * @param {string} value Texte à afficher.
 */
function setTextById(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  element.textContent = value;
}

/**
 * Appelle l'API des résultats pour un Syncer.
 *
 * @param {string} syncerId Identifiant du Syncer.
 * @returns {Promise<Object>} Réponse JSON.
 * @throws {Error} Si la réponse HTTP est en erreur.
 */
async function fetchSyncerResults(syncerId) {
  const response = await fetch(`/api/syncers/${encodeURIComponent(syncerId)}/results`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const rawResponse = await response.text();
  let data = {};
  try {
    data = rawResponse ? JSON.parse(rawResponse) : {};
  } catch (_parseError) {
    data = {};
  }

  if (!response.ok) {
    const backendMessage = data.error || "";
    const fallbackMessage = rawResponse ? rawResponse.slice(0, 180) : "";
    const details = backendMessage || fallbackMessage || "Aucun détail serveur.";
    throw new Error(
      `Erreur chargement résultats (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

/**
 * Rend les informations principales du Syncer.
 *
 * @param {Object} syncer Données Syncer.
 * @param {number} participantsCount Nombre total de participants.
 */
function renderSyncerHeader(syncer, participantsCount) {
  const syncerName = String(syncer?.name || "-");
  const eventStartDate = String(syncer?.eventStartDate || "");
  const eventEndDate = String(syncer?.eventEndDate || "");

  setTextById("syncer-name", syncerName);
  if (!eventStartDate || !eventEndDate) {
    setTextById("syncer-period", "Non configurée");
  } else {
    setTextById(
      "syncer-period",
      `Du ${formatHumanDate(eventStartDate)} au ${formatHumanDate(eventEndDate)}`
    );
  }
  setTextById("participants-count", String(participantsCount || 0));
}

let resultsCalendar = null;
let resultsDailyAvailabilityByDate = new Map();
let resultsBestDateSet = new Set();
let resultsMaxAvailableCount = 0;
let resultsEventStartDate = "";
let resultsEventEndDate = "";
let resultsCalendarMode = "aggregate";
let resultsSelectedParticipant = null;
let resultsParticipantsById = new Map();
let resultsHostExceptionDatesSet = new Set();

/**
 * Indique si le host a exclu cette date de l'évènement.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {boolean} true si le jour est une exception host.
 */
function isHostExceptionDate(isoDate) {
  return resultsHostExceptionDatesSet.has(isoDate);
}

/**
 * Charge les jours d'exception du host dans la plage courante.
 *
 * @param {Array<string>} exceptionDates Jours d'exception.
 */
function applyHostExceptionDates(exceptionDates) {
  resultsHostExceptionDatesSet = new Set();
  if (!Array.isArray(exceptionDates)) {
    return;
  }

  for (const date of exceptionDates) {
    const isoDate = String(date || "");
    if (isDateWithinRange(isoDate, resultsEventStartDate, resultsEventEndDate)) {
      resultsHostExceptionDatesSet.add(isoDate);
    }
  }
}

/**
 * Vérifie qu'une date ISO est dans la plage [start, end].
 *
 * @param {string} isoDate Date testée.
 * @param {string} start Début de plage.
 * @param {string} end Fin de plage.
 * @returns {boolean} true si date valide et dans la plage.
 */
function isDateWithinRange(isoDate, start, end) {
  if (!isoDate || !start || !end) {
    return false;
  }
  return isoDate >= start && isoDate <= end;
}

/**
 * Convertit une date locale JS en format ISO (YYYY-MM-DD).
 *
 * @param {Date} date Date à convertir.
 * @returns {string} Date ISO locale.
 */
function formatDateLocalIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Ajoute un jour à une date ISO (YYYY-MM-DD).
 *
 * @param {string} isoDate Date ISO d'entrée.
 * @returns {string} Date ISO + 1 jour.
 */
function addOneDayIso(isoDate) {
  const parts = String(isoDate || "").split("-");
  if (parts.length !== 3) {
    return isoDate;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return isoDate;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

const RESULTS_CALENDAR_DAY_CLASSES = [
  "fc-day-score-best",
  "fc-day-score-high",
  "fc-day-score-medium",
  "fc-day-score-low",
  "fc-day-score-none",
  "fc-day-available",
  "fc-day-unavailable",
  "fc-day-unspecified",
  "fc-day-out-of-range",
  "fc-day-host-exception",
];

/**
 * Retourne la classe CSS de score pour une date du calendrier global.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Classe CSS.
 */
function getDateScoreClass(isoDate) {
  if (!isDateWithinRange(isoDate, resultsEventStartDate, resultsEventEndDate)) {
    return "fc-day-out-of-range";
  }

  if (isHostExceptionDate(isoDate)) {
    return "fc-day-host-exception";
  }

  const row = resultsDailyAvailabilityByDate.get(isoDate);
  const availableCount = Number(row?.availableCount || 0);

  if (resultsBestDateSet.has(isoDate) && availableCount > 0) {
    return "fc-day-score-best";
  }

  if (resultsMaxAvailableCount === 0 || availableCount === 0) {
    return "fc-day-score-none";
  }

  const ratio = availableCount / resultsMaxAvailableCount;
  if (ratio >= 0.67) {
    return "fc-day-score-high";
  }
  if (ratio >= 0.34) {
    return "fc-day-score-medium";
  }

  return "fc-day-score-low";
}

/**
 * Retourne la classe CSS pour une date d'un participant.
 *
 * @param {Object} participant Données participant.
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Classe CSS.
 */
function getParticipantDateClass(participant, isoDate) {
  if (!isDateWithinRange(isoDate, resultsEventStartDate, resultsEventEndDate)) {
    return "fc-day-out-of-range";
  }

  if (isHostExceptionDate(isoDate)) {
    return "fc-day-host-exception";
  }

  const unavailableDates = Array.isArray(participant?.unavailableDates)
    ? participant.unavailableDates
    : [];
  const availableDates = Array.isArray(participant?.availableDates) ? participant.availableDates : [];

  if (unavailableDates.includes(isoDate)) {
    return "fc-day-unavailable";
  }
  if (availableDates.includes(isoDate)) {
    return "fc-day-available";
  }
  if (participant?.availabilityModel === "three-state") {
    return "fc-day-unspecified";
  }

  return "fc-day-available";
}

/**
 * Retourne la classe CSS courante d'une cellule du calendrier résultats.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Classe CSS.
 */
function getResultsCalendarDayClass(isoDate) {
  if (resultsCalendarMode === "participant" && resultsSelectedParticipant) {
    return getParticipantDateClass(resultsSelectedParticipant, isoDate);
  }

  return getDateScoreClass(isoDate);
}

/**
 * Construit le titre affiché au survol d'un jour du calendrier global.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Texte descriptif.
 */
function buildDateScoreTitle(isoDate) {
  if (isHostExceptionDate(isoDate)) {
    return "Organisateur indisponible";
  }

  const row = resultsDailyAvailabilityByDate.get(isoDate);
  if (!row) {
    return "";
  }

  const availableCount = Number(row.availableCount || 0);
  const unavailableCount = Number(row.unavailableCount || 0);
  const unspecifiedCount = Number(row.unspecifiedCount || 0);
  const availabilityRate = Number(row.availabilityRate || 0);

  return `${availableCount} dispo / ${unavailableCount} indispo / ${unspecifiedCount} non renseigné (${availabilityRate}%)`;
}

/**
 * Construit le titre affiché au survol d'un jour en mode participant.
 *
 * @param {Object} participant Données participant.
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Texte descriptif.
 */
function buildParticipantDateTitle(participant, isoDate) {
  const dayClass = getParticipantDateClass(participant, isoDate);
  if (dayClass === "fc-day-out-of-range") {
    return "";
  }
  if (dayClass === "fc-day-host-exception") {
    return "Organisateur indisponible";
  }
  if (dayClass === "fc-day-unavailable") {
    return "Indisponible";
  }
  if (dayClass === "fc-day-available") {
    return "Disponible";
  }
  return "Non renseigné";
}

/**
 * Retourne toutes les dates ISO de la plage de l'évènement.
 *
 * @returns {Array<string>} Dates dans la plage.
 */
function buildResultsEventDateRange() {
  const dates = [];
  if (!resultsEventStartDate || !resultsEventEndDate) {
    return dates;
  }

  let currentDate = resultsEventStartDate;
  while (currentDate <= resultsEventEndDate) {
    dates.push(currentDate);
    currentDate = addOneDayIso(currentDate);
  }

  return dates;
}

/**
 * Retourne les classes de jour réellement affichées en vue globale.
 *
 * @returns {Set<string>} Classes CSS utilisées sur le calendrier.
 */
function collectAggregateLegendDayClasses() {
  const usedClasses = new Set();
  for (const isoDate of buildResultsEventDateRange()) {
    const dayClass = getDateScoreClass(isoDate);
    if (dayClass !== "fc-day-out-of-range") {
      usedClasses.add(dayClass);
    }
  }
  return usedClasses;
}

/**
 * Retourne les classes de jour réellement affichées pour un participant.
 *
 * @param {Object} participant Données participant.
 * @returns {Set<string>} Classes CSS utilisées sur le calendrier.
 */
function collectParticipantLegendDayClasses(participant) {
  const usedClasses = new Set();
  for (const isoDate of buildResultsEventDateRange()) {
    const dayClass = getParticipantDateClass(participant, isoDate);
    if (dayClass !== "fc-day-out-of-range") {
      usedClasses.add(dayClass);
    }
  }
  return usedClasses;
}

/**
 * Affiche uniquement les entrées de légende présentes sur le calendrier.
 *
 * @param {boolean} isParticipantMode Indique si la vue participant est active.
 */
function updateResultsCalendarLegendItems(isParticipantMode) {
  const aggregateLegend = document.getElementById("results-calendar-legend-aggregate");
  if (aggregateLegend) {
    const usedClasses = collectAggregateLegendDayClasses();
    let visibleCount = 0;

    for (const item of aggregateLegend.querySelectorAll("li[data-legend-day-class]")) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }

      const dayClass = String(item.dataset.legendDayClass || "");
      const isVisible = usedClasses.has(dayClass);
      item.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    }

    aggregateLegend.hidden = isParticipantMode || visibleCount === 0;
  }

  const participantLegend = document.getElementById("results-calendar-legend-participant");
  if (participantLegend) {
    const usedClasses =
      isParticipantMode && resultsSelectedParticipant
        ? collectParticipantLegendDayClasses(resultsSelectedParticipant)
        : new Set();
    let visibleCount = 0;

    for (const item of participantLegend.querySelectorAll("li[data-legend-day-class]")) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }

      const dayClass = String(item.dataset.legendDayClass || "");
      const isVisible = usedClasses.has(dayClass);
      item.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    }

    participantLegend.hidden = !isParticipantMode || visibleCount === 0;
  }
}

/**
 * Met à jour l'interface autour du calendrier selon le mode actif.
 */
const RESULTS_CALENDAR_AGGREGATE_TITLE = "Top dates recommandées";

function updateResultsCalendarChrome() {
  const titleElement = document.getElementById("results-calendar-title");
  const introElement = document.getElementById("results-calendar-intro");
  const resetButton = document.getElementById("reset-calendar-view-button");

  const isParticipantMode =
    resultsCalendarMode === "participant" && resultsSelectedParticipant !== null;
  const participantName = String(resultsSelectedParticipant?.name || "Participant");

  if (titleElement) {
    titleElement.textContent = isParticipantMode
      ? `Calendrier de ${participantName}`
      : RESULTS_CALENDAR_AGGREGATE_TITLE;
  }
  if (introElement) {
    introElement.hidden = isParticipantMode;
  }
  if (resetButton) {
    resetButton.hidden = !isParticipantMode;
  }
  updateResultsCalendarLegendItems(isParticipantMode);

  const calendarRoot = document.getElementById("results-calendar");
  if (calendarRoot) {
    calendarRoot.classList.toggle("results-calendar--aggregate", !isParticipantMode);
    calendarRoot.classList.toggle("results-calendar--participant", isParticipantMode);
  }
}

/**
 * Formate une date ISO en texte lisible.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Date formatée en français.
 */
function formatHumanDate(isoDate) {
  const value = String(isoDate || "").trim();
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const formatted = parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return formatted.replace(/(^|\s)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

/**
 * Ouvre la modale listant les participants disponibles pour une date.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 */
function openDayAvailabilityModal(isoDate) {
  const modalElement = document.getElementById("day-availability-modal");
  const titleElement = document.getElementById("day-availability-modal-title");
  const summaryElement = document.getElementById("day-availability-modal-summary");
  const listElement = document.getElementById("day-availability-modal-list");
  if (!modalElement || !titleElement || !summaryElement || !listElement) {
    return;
  }

  const row = resultsDailyAvailabilityByDate.get(isoDate);
  const availableParticipants = Array.isArray(row?.availableParticipants)
    ? row.availableParticipants
    : [];
  const availableCount = Number(row?.availableCount || availableParticipants.length);

  titleElement.textContent = `Participants disponibles`;
  summaryElement.textContent = `${formatHumanDate(isoDate)} — ${availableCount} participant(s) disponible(s)`;

  listElement.innerHTML = "";
  if (availableParticipants.length === 0) {
    const li = document.createElement("li");
    li.className = "day-availability-empty";
    li.textContent = "Aucun participant disponible ce jour-là.";
    listElement.appendChild(li);
  } else {
    for (const name of availableParticipants) {
      const li = document.createElement("li");
      li.textContent = String(name);
      listElement.appendChild(li);
    }
  }

  modalElement.hidden = false;
  document.body.style.overflow = "hidden";

  const closeButton = modalElement.querySelector(".results-day-modal-close");
  if (closeButton instanceof HTMLButtonElement) {
    closeButton.focus();
  }
}

/**
 * Ferme la modale des participants disponibles.
 */
function closeDayAvailabilityModal() {
  const modalElement = document.getElementById("day-availability-modal");
  if (!modalElement || modalElement.hidden) {
    return;
  }

  modalElement.hidden = true;
  document.body.style.overflow = "";
}

/**
 * Active visuellement le bouton du participant sélectionné.
 *
 * @param {string} participantId Identifiant du participant actif, ou chaîne vide.
 */
function updateParticipantButtonStates(participantId) {
  const buttons = document.querySelectorAll(".show-participant-calendar-button");
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const isActive = Boolean(participantId) && button.dataset.participantId === participantId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.textContent = isActive ? "Calendrier affiché" : "Voir le calendrier";
  }
}

/**
 * Affiche les disponibilités d'un participant sur le calendrier.
 *
 * @param {Object} participant Données participant.
 */
function showParticipantOnCalendar(participant) {
  resultsCalendarMode = "participant";
  resultsSelectedParticipant = participant;
  updateResultsCalendarChrome();
  updateParticipantButtonStates(String(participant?.id || ""));
  updateResultsCalendarDayClasses();

  const calendarSection = document.getElementById("results-calendar-section");
  if (calendarSection) {
    calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Reviens à la vue globale du calendrier.
 */
function resetResultsCalendarView() {
  resultsCalendarMode = "aggregate";
  resultsSelectedParticipant = null;
  updateResultsCalendarChrome();
  updateParticipantButtonStates("");
  updateResultsCalendarDayClasses();
}

/**
 * Applique les classes sur les cellules du calendrier résultats.
 */
function updateResultsCalendarDayClasses() {
  if (resultsCalendar && typeof resultsCalendar.rerenderDates === "function") {
    resultsCalendar.rerenderDates();
  }

  const dayCells = document.querySelectorAll("#results-calendar .fc-daygrid-day[data-date]");
  for (const cell of dayCells) {
    if (!(cell instanceof HTMLElement)) {
      continue;
    }

    const isoDate = String(cell.dataset.date || "");
    cell.classList.remove(...RESULTS_CALENDAR_DAY_CLASSES);
    cell.classList.add(getResultsCalendarDayClass(isoDate));

    if (resultsCalendarMode === "participant" && resultsSelectedParticipant) {
      const title = buildParticipantDateTitle(resultsSelectedParticipant, isoDate);
      if (title) {
        cell.title = title;
      } else {
        cell.removeAttribute("title");
      }
      continue;
    }

    const title = buildDateScoreTitle(isoDate);
    if (title) {
      cell.title = title;
    } else {
      cell.removeAttribute("title");
    }
  }
}

/**
 * Affiche le calendrier des meilleures dates avec un dégradé vert / jaune.
 *
 * @param {Object} syncer Données Syncer.
 * @param {Array<Object>} dailyAvailability Disponibilités journalières.
 * @param {Array<Object>} bestDates Top des dates.
 */
function renderBestDatesCalendar(syncer, dailyAvailability, bestDates) {
  const pickerElement = document.getElementById("best-dates-calendar-picker");
  if (!pickerElement) {
    return;
  }

  const eventStartDate = String(syncer?.eventStartDate || "");
  const eventEndDate = String(syncer?.eventEndDate || "");
  resultsEventStartDate = eventStartDate;
  resultsEventEndDate = eventEndDate;
  const exceptionDates = Array.isArray(syncer?.exceptionDates) ? syncer.exceptionDates : [];
  applyHostExceptionDates(exceptionDates);

  resultsDailyAvailabilityByDate = new Map();
  resultsBestDateSet = new Set();
  resultsMaxAvailableCount = 0;

  if (Array.isArray(dailyAvailability)) {
    for (const row of dailyAvailability) {
      const isoDate = String(row?.date || "");
      if (!isoDate) {
        continue;
      }
      resultsDailyAvailabilityByDate.set(isoDate, row);
      resultsMaxAvailableCount = Math.max(
        resultsMaxAvailableCount,
        Number(row?.availableCount || 0)
      );
    }
  }

  if (Array.isArray(bestDates)) {
    for (const row of bestDates) {
      const isoDate = String(row?.date || "");
      if (isoDate) {
        resultsBestDateSet.add(isoDate);
      }
    }
  }

  resultsCalendarMode = "aggregate";
  resultsSelectedParticipant = null;
  updateResultsCalendarChrome();
  updateParticipantButtonStates("");

  if (!eventStartDate || !eventEndDate) {
    pickerElement.innerHTML =
      "<p>La période de l'évènement n'est pas configurée. Aucun calendrier à afficher.</p>";
    return;
  }

  if (!window.FullCalendar || !window.FullCalendar.Calendar) {
    pickerElement.innerHTML = "<p>Calendrier indisponible pour le moment.</p>";
    return;
  }

  pickerElement.innerHTML = "";
  const calendarRoot = document.createElement("div");
  calendarRoot.id = "results-calendar";
  pickerElement.appendChild(calendarRoot);

  if (resultsCalendar) {
    resultsCalendar.destroy();
    resultsCalendar = null;
  }

  resultsCalendar = new window.FullCalendar.Calendar(calendarRoot, {
    initialView: "dayGridMonth",
    initialDate: eventStartDate,
    locale: "fr",
    firstDay: 1,
    fixedWeekCount: true,
    ...getSyncMatesCalendarOptions(640),
    validRange: {
      start: eventStartDate,
      end: addOneDayIso(eventEndDate),
    },
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    datesSet: () => {
      requestAnimationFrame(() => {
        updateResultsCalendarDayClasses();
      });
    },
    dayCellClassNames: (arg) => {
      const isoDate = formatDateLocalIso(arg.date);
      return [getResultsCalendarDayClass(isoDate)];
    },
    dateClick: (info) => {
      if (resultsCalendarMode !== "aggregate") {
        return;
      }

      const isoDate = info.dateStr;
      if (!isDateWithinRange(isoDate, resultsEventStartDate, resultsEventEndDate)) {
        return;
      }

      if (isHostExceptionDate(isoDate)) {
        return;
      }

      openDayAvailabilityModal(isoDate);
    },
  });

  resultsCalendar.render();
  bindSyncMatesResponsiveCalendar(resultsCalendar, 640);
  calendarRoot.classList.add("results-calendar--aggregate");
  requestAnimationFrame(() => {
    updateResultsCalendarDayClasses();
  });
}
/**
 * Rend le tableau détaillé de disponibilité par date.
 *
 * @param {Array<Object>} dailyAvailability Données journalières.
 */
function renderDailyAvailabilityTable(dailyAvailability) {
  const tableBody = document.getElementById("availability-table-body");
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = "";
  if (!Array.isArray(dailyAvailability) || dailyAvailability.length === 0) {
    tableBody.innerHTML = "<tr><td colspan=\"5\">Aucune donnée de disponibilité à afficher.</td></tr>";
    return;
  }

  for (const row of dailyAvailability) {
    const tr = document.createElement("tr");

    const date = String(row?.date || "-");
    const availableCount = Number(row?.availableCount || 0);
    const unavailableCount = Number(row?.unavailableCount || 0);
    const unspecifiedCount = Number(row?.unspecifiedCount || 0);
    const availabilityRate = Number(row?.availabilityRate || 0);

    const dateTd = document.createElement("td");
    dateTd.textContent = date;
    tr.appendChild(dateTd);

    const availableTd = document.createElement("td");
    availableTd.textContent = String(availableCount);
    tr.appendChild(availableTd);

    const unavailableTd = document.createElement("td");
    unavailableTd.textContent = String(unavailableCount);
    tr.appendChild(unavailableTd);

    const unspecifiedTd = document.createElement("td");
    unspecifiedTd.textContent = String(unspecifiedCount);
    tr.appendChild(unspecifiedTd);

    const rateTd = document.createElement("td");
    rateTd.textContent = `${availabilityRate}%`;
    tr.appendChild(rateTd);

    tableBody.appendChild(tr);
  }
}

/**
 * Rend le résumé des participants.
 *
 * @param {Array<Object>} participants Liste des participants.
 */
function renderParticipantsSummary(participants) {
  const listElement = document.getElementById("participants-summary-list");
  if (!listElement) {
    return;
  }

  resultsParticipantsById = new Map();
  listElement.innerHTML = "";
  if (!Array.isArray(participants) || participants.length === 0) {
    listElement.innerHTML = "<li>Aucun participant pour le moment.</li>";
    return;
  }

  for (const participant of participants) {
    const participantId = String(participant?.id || "");
    const name = String(participant?.name || "Participant");
    if (!participantId) {
      continue;
    }

    resultsParticipantsById.set(participantId, participant);

    const li = document.createElement("li");
    li.className = "participant-summary-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "participant-summary-name";
    nameSpan.textContent = name;
    li.appendChild(nameSpan);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "show-participant-calendar-button";
    button.dataset.participantId = participantId;
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Voir le calendrier";
    li.appendChild(button);

    listElement.appendChild(li);
  }

  if (
    resultsCalendarMode === "participant" &&
    resultsSelectedParticipant &&
    resultsParticipantsById.has(String(resultsSelectedParticipant.id || ""))
  ) {
    resultsSelectedParticipant = resultsParticipantsById.get(String(resultsSelectedParticipant.id));
    updateParticipantButtonStates(String(resultsSelectedParticipant?.id || ""));
    updateResultsCalendarDayClasses();
  }
}

/**
 * Charge et rend tous les blocs de la page résultat.
 */
async function loadResults() {
  const syncerId = getQueryParam("syncerId");
  if (!syncerId) {
    return;
  }

  try {
    const response = await fetchSyncerResults(syncerId);
    const results = response?.results || {};

    renderSyncerHeader(results.syncer || {}, Number(results.participantsCount || 0));
    renderBestDatesCalendar(
      results.syncer || {},
      Array.isArray(results.dailyAvailability) ? results.dailyAvailability : [],
      Array.isArray(results.bestDates) ? results.bestDates : []
    );
    renderDailyAvailabilityTable(
      Array.isArray(results.dailyAvailability) ? results.dailyAvailability : []
    );
    renderParticipantsSummary(Array.isArray(results.participants) ? results.participants : []);
  } catch (_error) {
    // Erreur silencieuse : les blocs restent dans leur état initial.
  }
}

/**
 * Branche un bouton plier/déplier sur un conteneur.
 *
 * @param {string} buttonId Identifiant du bouton.
 * @param {string} contentId Identifiant du conteneur.
 */
function bindCollapsibleSection(buttonId, contentId) {
  const toggleButton = document.getElementById(buttonId);
  const contentElement = document.getElementById(contentId);
  if (!toggleButton || !contentElement) {
    return;
  }

  toggleButton.addEventListener("click", () => {
    const isExpanded = !contentElement.hidden;
    contentElement.hidden = isExpanded;
    toggleButton.setAttribute("aria-expanded", String(!isExpanded));
    toggleButton.textContent = isExpanded ? "Afficher le détail" : "Masquer le détail";
  });
}

bindCollapsibleSection("toggle-participants-button", "participants-section-content");
bindCollapsibleSection("toggle-daily-detail-button", "daily-detail-content");

const dayAvailabilityModal = document.getElementById("day-availability-modal");
if (dayAvailabilityModal) {
  dayAvailabilityModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-modal-close]")) {
      closeDayAvailabilityModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDayAvailabilityModal();
  }
});

const resetCalendarViewButton = document.getElementById("reset-calendar-view-button");
if (resetCalendarViewButton) {
  resetCalendarViewButton.addEventListener("click", () => {
    resetResultsCalendarView();
  });
}

const participantsSummaryList = document.getElementById("participants-summary-list");
if (participantsSummaryList) {
  participantsSummaryList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    if (!target.classList.contains("show-participant-calendar-button")) {
      return;
    }

    const participantId = String(target.dataset.participantId || "");
    const participant = resultsParticipantsById.get(participantId);
    if (!participant) {
      return;
    }

    showParticipantOnCalendar(participant);
  });
}

loadResults();

