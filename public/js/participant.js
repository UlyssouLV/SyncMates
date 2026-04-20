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
  if (dates.length === 0) {
    pickerElement.innerHTML =
      "<p>Plage non configurée. Le host doit définir une date de début et de fin.</p>";
    return;
  }

  pickerElement.innerHTML = "";
  const list = document.createElement("div");

  for (const isoDate of dates) {
    const item = document.createElement("label");
    item.style.display = "block";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "unavailableDate";
    checkbox.value = isoDate;

    item.appendChild(checkbox);
    item.append(` ${isoDate}`);
    list.appendChild(item);
  }

  pickerElement.appendChild(list);
}

/**
 * Coche les dates indisponibles passées en entrée.
 *
 * @param {Array<string>} unavailableDates Dates indisponibles.
 */
function applyUnavailableDatesSelection(unavailableDates) {
  const selectedDates = new Set(Array.isArray(unavailableDates) ? unavailableDates : []);
  const checkboxes = document.querySelectorAll('#unavailability-picker input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = selectedDates.has(checkbox.value);
    }
  }
}

/**
 * Récupère la liste des dates cochées dans la grille.
 *
 * @returns {Array<string>} Dates indisponibles sélectionnées.
 */
function collectSelectedUnavailableDates() {
  const selectedDates = [];
  const checkboxes = document.querySelectorAll('#unavailability-picker input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    if (checkbox instanceof HTMLInputElement && checkbox.checked) {
      selectedDates.push(checkbox.value);
    }
  }
  return selectedDates;
}

/**
 * Met à jour l'aperçu des indisponibilités.
 *
 * @param {Array<string>} unavailableDates Dates indisponibles.
 */
function renderUnavailableDatesPreview(unavailableDates) {
  const previewElement = document.getElementById("unavailable-dates-preview");
  if (!previewElement) {
    return;
  }

  previewElement.innerHTML = "";
  if (!Array.isArray(unavailableDates) || unavailableDates.length === 0) {
    previewElement.innerHTML = "<li>Aucune indisponibilité enregistrée pour le moment.</li>";
    return;
  }

  for (const date of unavailableDates) {
    const item = document.createElement("li");
    item.textContent = String(date);
    previewElement.appendChild(item);
  }
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
let selectedParticipantId = "";

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
    setTextById("selected-participant-name", selectedOption.textContent || "-");
    setSelectionFeedback("Profil sélectionné.", false);

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
      renderUnavailableDatesPreview(unavailableDates);
      setUnavailabilitiesFeedback("Indisponibilités chargées.", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setUnavailabilitiesFeedback(message, true);
    }
  });
}

const clearUnavailabilitiesButton = document.getElementById("clear-unavailabilities-button");
if (clearUnavailabilitiesButton) {
  clearUnavailabilitiesButton.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll('#unavailability-picker input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = false;
      }
    }
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
      renderUnavailableDatesPreview(savedUnavailableDates);
      setUnavailabilitiesFeedback("Indisponibilités enregistrées.", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setUnavailabilitiesFeedback(message, true);
    }
  });
}

