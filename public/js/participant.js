/**
 * Script frontend de la page participant.
 *
 * Ce fichier:
 * - récupère le syncerId depuis l'URL,
 * - charge les profils participants via l'API,
 * - alimente le select de sélection de profil,
 * - affiche les informations du Syncer,
 * - charge et enregistre les indisponibilités d'un profil.
 */

/**
 * Lit un paramètre de l'URL courante.
 *
 * @param {string} key Nom du paramètre.
 * @returns {string} Valeur du paramètre ou chaîne vide.
 */
function getQueryParam(key) {
  const url = new URL(window.location.href);
  return String(url.searchParams.get(key) || "");
}

/**
 * Met à jour le texte d'un élément par son id.
 *
 * @param {string} elementId Identifiant HTML ciblé.
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
 * Formate une date ISO en texte lisible.
 *
 * @param {string} isoDate Date ISO source.
 * @returns {string} Date formatée en français ou valeur brute.
 */
function formatHumanDate(isoDate) {
  const value = String(isoDate || "").trim();
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Affiche un feedback dans la section sélection de profil.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique s'il s'agit d'une erreur.
 */
function setSelectionFeedback(message, isError) {
  const feedbackElement = document.getElementById("participant-selection-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

/**
 * Affiche un feedback dans la section indisponibilités.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique s'il s'agit d'une erreur.
 */
function setUnavailabilitiesFeedback(message, isError) {
  const feedbackElement = document.getElementById("participant-unavailabilities-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

let unavailableDatesSet = new Set();
let currentEventStartDate = "";
let currentEventEndDate = "";
let participantCalendar = null;

/**
 * Appelle l'API pour récupérer les profils participants d'un Syncer.
 *
 * @param {string} syncerId Identifiant technique du Syncer.
 * @returns {Promise<Object>} Réponse JSON.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function fetchSyncerParticipants(syncerId) {
  const response = await fetch(`/api/syncers/${encodeURIComponent(syncerId)}/participants`, {
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
      `Erreur chargement profils (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

/**
 * Alimente le select de profils participants.
 *
 * @param {Array<Object>} participants Liste de profils.
 */
function fillParticipantSelect(participants) {
  const selectElement = document.getElementById("participant-select");
  if (!(selectElement instanceof HTMLSelectElement)) {
    return;
  }

  selectElement.innerHTML = '<option value="">-- Choisir --</option>';
  for (const participant of participants) {
    const participantId = String(participant?.id || "");
    const participantName = String(participant?.name || "");
    if (!participantId || !participantName) {
      continue;
    }

    const option = document.createElement("option");
    option.value = participantId;
    option.textContent = participantName;
    selectElement.appendChild(option);
  }
}

/**
 * Rend la période configurée du Syncer.
 *
 * @param {string|null} eventStartDate Date de début.
 * @param {string|null} eventEndDate Date de fin.
 */
function renderSyncerPeriod(eventStartDate, eventEndDate) {
  if (!eventStartDate || !eventEndDate) {
    setTextById("syncer-period", "Non configurée");
    return;
  }

  setTextById(
    "syncer-period",
    `Du ${formatHumanDate(eventStartDate)} au ${formatHumanDate(eventEndDate)}`
  );
}

/**
 * Génère une liste de dates (YYYY-MM-DD) entre deux bornes incluses.
 *
 * @param {string} eventStartDate Date de début.
 * @param {string} eventEndDate Date de fin.
 * @returns {Array<string>} Tableau de dates.
 */
function buildDateRange(eventStartDate, eventEndDate) {
  const dates = [];
  if (!eventStartDate || !eventEndDate) {
    return dates;
  }

  const parseIsoDateToUtc = (isoDate) => {
    const parts = isoDate.split("-");
    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }

    return new Date(Date.UTC(year, month - 1, day));
  };

  const formatUtcDateToIso = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const start = parseIsoDateToUtc(eventStartDate);
  const end = parseIsoDateToUtc(eventEndDate);
  if (!(start instanceof Date) || !(end instanceof Date) || start > end) {
    return dates;
  }

  const current = new Date(start);
  while (current <= end) {
    const isoDate = formatUtcDateToIso(current);
    dates.push(isoDate);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Affiche la grille de sélection des indisponibilités.
 *
 * @param {string} eventStartDate Date de début de la plage.
 * @param {string} eventEndDate Date de fin de la plage.
 */
function renderUnavailabilityPicker(eventStartDate, eventEndDate) {
  const pickerElement = document.getElementById("unavailability-picker");
  if (!pickerElement) {
    return;
  }

  const dates = buildDateRange(eventStartDate, eventEndDate);
  currentEventStartDate = String(eventStartDate || "");
  currentEventEndDate = String(eventEndDate || "");
  unavailableDatesSet = new Set();

  if (dates.length === 0) {
    pickerElement.innerHTML =
      "<p>Plage non configurée. Le host doit définir une date de début et de fin.</p>";
    return;
  }

  if (!window.FullCalendar || !window.FullCalendar.Calendar) {
    pickerElement.innerHTML = "<p>Calendrier indisponible pour le moment.</p>";
    return;
  }

  pickerElement.innerHTML = "";
  const calendarRoot = document.createElement("div");
  calendarRoot.id = "participant-calendar";
  pickerElement.appendChild(calendarRoot);

  if (participantCalendar) {
    participantCalendar.destroy();
    participantCalendar = null;
  }

  participantCalendar = new window.FullCalendar.Calendar(calendarRoot, {
    initialView: "dayGridMonth",
    initialDate: currentEventStartDate,
    locale: "fr",
    firstDay: 1,
    fixedWeekCount: true,
    height: 640,
    expandRows: true,
    validRange: {
      start: currentEventStartDate,
      end: addOneDayIso(currentEventEndDate),
    },
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    datesSet: () => {
      // Re-applique les classes à chaque changement/rendu de vue mensuelle.
      requestAnimationFrame(() => {
        updateCalendarDayClasses();
      });
    },
    dayCellClassNames: (arg) => {
      const isoDate = formatDateLocalIso(arg.date);
      if (!isDateWithinRange(isoDate, currentEventStartDate, currentEventEndDate)) {
        return ["fc-day-out-of-range"];
      }

      if (unavailableDatesSet.has(isoDate)) {
        return ["fc-day-unavailable"];
      }

      return ["fc-day-available"];
    },
    dateClick: (info) => {
      const isoDate = info.dateStr;
      if (!isDateWithinRange(isoDate, currentEventStartDate, currentEventEndDate)) {
        return;
      }

      if (unavailableDatesSet.has(isoDate)) {
        unavailableDatesSet.delete(isoDate);
      } else {
        unavailableDatesSet.add(isoDate);
      }

      updateCalendarDayClasses();
    },
  });

  participantCalendar.render();
  requestAnimationFrame(() => {
    updateCalendarDayClasses();
  });
}

/**
 * Coche les dates indisponibles passées en entrée.
 *
 * @param {Array<string>} unavailableDates Dates indisponibles.
 */
function applyUnavailableDatesSelection(unavailableDates) {
  const nextSet = new Set();
  if (Array.isArray(unavailableDates)) {
    for (const date of unavailableDates) {
      const isoDate = String(date || "");
      if (isDateWithinRange(isoDate, currentEventStartDate, currentEventEndDate)) {
        nextSet.add(isoDate);
      }
    }
  }

  unavailableDatesSet = nextSet;
  updateCalendarDayClasses();
}

/**
 * Récupère la liste des dates cochées dans la grille.
 *
 * @returns {Array<string>} Dates indisponibles sélectionnées.
 */
function collectSelectedUnavailableDates() {
  return Array.from(unavailableDatesSet).sort();
}

/**
 * Charge les indisponibilités d'un participant.
 *
 * @param {string} currentSyncerId Identifiant du Syncer.
 * @param {string} participantId Identifiant du participant.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function fetchParticipantUnavailabilities(currentSyncerId, participantId) {
  const response = await fetch(
    `/api/syncers/${encodeURIComponent(currentSyncerId)}/participants/${encodeURIComponent(
      participantId
    )}/unavailabilities`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

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
      `Erreur chargement indisponibilités (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

/**
 * Enregistre les indisponibilités d'un participant.
 *
 * @param {string} currentSyncerId Identifiant du Syncer.
 * @param {string} participantId Identifiant du participant.
 * @param {Array<string>} unavailableDates Dates indisponibles.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function saveParticipantUnavailabilities(currentSyncerId, participantId, unavailableDates) {
  const response = await fetch(
    `/api/syncers/${encodeURIComponent(currentSyncerId)}/participants/${encodeURIComponent(
      participantId
    )}/unavailabilities`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        unavailableDates,
      }),
    }
  );

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
      `Erreur enregistrement indisponibilités (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

const syncerId = getQueryParam("syncerId");
const participantSelectionForm = document.getElementById("participant-selection-form");
const participantUnavailabilitiesForm = document.getElementById("participant-unavailabilities-form");
const participantSelect = document.getElementById("participant-select");
const participantSelectControls = document.getElementById("participant-select-controls");
const participantSelectLabel = document.getElementById("participant-select-label");
const validateProfileButton = document.getElementById("validate-profile-button");
const changeProfileButton = document.getElementById("change-profile-button");
const participantUnavailabilitiesSection = document.getElementById("participant-unavailabilities-section");
let selectedParticipantId = "";

if (participantUnavailabilitiesSection) {
  participantUnavailabilitiesSection.hidden = true;
}
if (!syncerId) {
  setSelectionFeedback("Lien invalide: paramètre syncerId manquant.", true);
} else {
  fetchSyncerParticipants(syncerId)
    .then((result) => {
      const syncer = result?.syncer || {};
      const participants = Array.isArray(syncer.participants) ? syncer.participants : [];

      setTextById("syncer-name", String(syncer.name || "-"));
      renderSyncerPeriod(syncer.eventStartDate || null, syncer.eventEndDate || null);
      renderUnavailabilityPicker(syncer.eventStartDate || null, syncer.eventEndDate || null);
      fillParticipantSelect(participants);

      if (participants.length === 0) {
        setSelectionFeedback("Aucun profil participant n'est encore disponible.", true);
      } else {
        setSelectionFeedback("Choisis ton profil pour continuer.", false);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setSelectionFeedback(message, true);
    });
}

if (participantSelectionForm && participantSelect instanceof HTMLSelectElement) {
  participantSelectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedOption = participantSelect.selectedOptions[0];
    if (!selectedOption || !participantSelect.value) {
      setSelectionFeedback("Merci de choisir un profil.", true);
      return;
    }

    selectedParticipantId = participantSelect.value;
    setSelectionFeedback("", false);

    if (participantSelectLabel) {
      participantSelectLabel.hidden = true;
    }
    if (participantSelect instanceof HTMLSelectElement) {
      participantSelect.disabled = true;
    }
    if (validateProfileButton) {
      validateProfileButton.hidden = true;
    }
    if (changeProfileButton) {
      changeProfileButton.hidden = false;
    }
    if (participantUnavailabilitiesSection) {
      participantUnavailabilitiesSection.hidden = false;
    }
    refreshParticipantCalendarLayout();

    if (!syncerId) {
      return;
    }

    setUnavailabilitiesFeedback("Chargement des indisponibilités...", false);
    try {
      const result = await fetchParticipantUnavailabilities(syncerId, selectedParticipantId);
      const unavailableDates = Array.isArray(result?.participant?.unavailableDates)
        ? result.participant.unavailableDates
        : [];
      applyUnavailableDatesSelection(unavailableDates);
      setUnavailabilitiesFeedback("Indisponibilités chargées.", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setUnavailabilitiesFeedback(message, true);
    }
  });
}

if (changeProfileButton) {
  changeProfileButton.addEventListener("click", () => {
    window.location.reload();
  });
}

const clearUnavailabilitiesButton = document.getElementById("clear-unavailabilities-button");
if (clearUnavailabilitiesButton) {
  clearUnavailabilitiesButton.addEventListener("click", () => {
    unavailableDatesSet = new Set();
    updateCalendarDayClasses();
  });
}

if (participantUnavailabilitiesForm) {
  participantUnavailabilitiesForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncerId) {
      setUnavailabilitiesFeedback("Lien invalide: syncerId manquant.", true);
      return;
    }

    if (!selectedParticipantId) {
      setUnavailabilitiesFeedback("Sélectionne d'abord ton profil.", true);
      return;
    }

    const unavailableDates = collectSelectedUnavailableDates();
    setUnavailabilitiesFeedback("Enregistrement en cours...", false);

    try {
      const result = await saveParticipantUnavailabilities(
        syncerId,
        selectedParticipantId,
        unavailableDates
      );
      const savedUnavailableDates = Array.isArray(result?.participant?.unavailableDates)
        ? result.participant.unavailableDates
        : [];
      applyUnavailableDatesSelection(savedUnavailableDates);
      setUnavailabilitiesFeedback("Indisponibilités enregistrées.", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setUnavailabilitiesFeedback(message, true);
    }
  });
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

/**
 * Force le recalcul des couleurs des jours du calendrier.
 */
function rerenderCalendarDayStates() {
  if (participantCalendar && typeof participantCalendar.rerenderDates === "function") {
    participantCalendar.rerenderDates();
  }
}

/**
 * Recalcule la taille du calendrier après affichage d'une section cachée.
 *
 * FullCalendar a besoin d'un layout visible pour mesurer correctement ses cellules.
 */
function refreshParticipantCalendarLayout() {
  if (!participantCalendar || typeof participantCalendar.updateSize !== "function") {
    return;
  }

  requestAnimationFrame(() => {
    participantCalendar.updateSize();
    updateCalendarDayClasses();
  });
}

/**
 * Applique immédiatement les classes de disponibilité sur les cellules.
 *
 * Cette mise à jour directe évite d'attendre un resize/reflow du calendrier.
 */
function updateCalendarDayClasses() {
  rerenderCalendarDayStates();

  const dayCells = document.querySelectorAll("#participant-calendar .fc-daygrid-day[data-date]");
  for (const cell of dayCells) {
    if (!(cell instanceof HTMLElement)) {
      continue;
    }

    const isoDate = String(cell.dataset.date || "");
    cell.classList.remove("fc-day-available", "fc-day-unavailable", "fc-day-out-of-range");

    if (!isDateWithinRange(isoDate, currentEventStartDate, currentEventEndDate)) {
      cell.classList.add("fc-day-out-of-range");
      continue;
    }

    if (unavailableDatesSet.has(isoDate)) {
      cell.classList.add("fc-day-unavailable");
      continue;
    }

    cell.classList.add("fc-day-available");
  }
}

