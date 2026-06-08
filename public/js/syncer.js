/**
 * Script frontend de la page syncer.
 *
 * Ce fichier initialise un affichage minimal du synchroniseur après connexion.
 * Il permet aussi l'ajout d'un participant via l'API backend.
 */

/**
 * Retourne la valeur d'un parametre de l'URL courante.
 *
 * @param {string} key Nom du parametre.
 * @returns {string} Valeur du parametre ou chaine vide.
 */
function getQueryParam(key) {
  const url = new URL(window.location.href);
  return String(url.searchParams.get(key) || "");
}

/**
 * Met a jour le texte d'un element cible par son id.
 *
 * @param {string} elementId Identifiant de l'element HTML.
 * @param {string} value Valeur texte a afficher.
 */
function setTextById(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = value;
}

/**
 * Formate une date ISO en texte lisible pour un humain.
 *
 * @param {string} isoDate Date ISO source.
 * @returns {string} Date formatée en français ou valeur d'origine.
 */
function formatHumanDateTime(isoDate) {
  const value = String(isoDate || "").trim();
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly) {
    return parsed.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Crée une erreur enrichie avec code HTTP.
 *
 * @param {string} message Message d'erreur.
 * @param {number} status Code HTTP.
 * @returns {Error & {status?: number}} Erreur enrichie.
 */
function buildHttpError(message, status) {
  const error = new Error(message);
  error.status = Number(status || 0);
  return error;
}

/**
 * Redirige vers host.html si la session host est invalide/expirée.
 *
 * @param {unknown} error Erreur levée par une requête API.
 * @returns {boolean} true si redirection déclenchée.
 */
function redirectToHostIfUnauthorized(error) {
  const status = Number(error?.status || 0);
  if (status !== 401) {
    return false;
  }

  const targetUrl = new URL("host.html", window.location.href);
  targetUrl.searchParams.set("reason", "session-expired");
  window.location.href = targetUrl.toString();
  return true;
}

/**
 * Affiche un feedback textuel pour l'ajout participant.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setAddParticipantFeedback(message, isError) {
  const feedbackElement = document.getElementById("add-participant-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

/**
 * Affiche un feedback textuel pour la configuration de période.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setEventPeriodFeedback(message, isError) {
  const feedbackElement = document.getElementById("event-period-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

/**
 * Affiche un feedback textuel pour la copie du lien de partage.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setShareLinkFeedback(message, isError) {
  const feedbackElement = document.getElementById("share-link-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

/**
 * Affiche un feedback pour les jours d'exception.
 *
 * @param {string} message Message utilisateur.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setExceptionDatesFeedback(message, isError) {
  const feedbackElement = document.getElementById("exception-dates-feedback");
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

let syncerExceptionDatesSet = new Set();
let syncerExceptionCalendar = null;
let syncerEventStartDate = "";
let syncerEventEndDate = "";

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
 * Retourne la classe CSS d'un jour du calendrier d'exceptions host.
 *
 * @param {string} isoDate Date ISO (YYYY-MM-DD).
 * @returns {string} Classe CSS.
 */
function getSyncerExceptionDayClass(isoDate) {
  if (!isDateWithinRange(isoDate, syncerEventStartDate, syncerEventEndDate)) {
    return "fc-day-out-of-range";
  }

  if (syncerExceptionDatesSet.has(isoDate)) {
    return "fc-day-exception";
  }

  return "fc-day-in-range";
}

/**
 * Applique les classes sur les cellules du calendrier d'exceptions.
 */
function updateSyncerExceptionCalendarDayClasses() {
  if (syncerExceptionCalendar && typeof syncerExceptionCalendar.rerenderDates === "function") {
    syncerExceptionCalendar.rerenderDates();
  }

  const dayCells = document.querySelectorAll("#syncer-exception-calendar .fc-daygrid-day[data-date]");
  for (const cell of dayCells) {
    if (!(cell instanceof HTMLElement)) {
      continue;
    }

    const isoDate = String(cell.dataset.date || "");
    cell.classList.remove("fc-day-in-range", "fc-day-exception", "fc-day-out-of-range");
    cell.classList.add(getSyncerExceptionDayClass(isoDate));
  }
}

/**
 * Applique la sélection des jours d'exception chargée depuis l'API.
 *
 * @param {Array<string>} exceptionDates Jours d'exception.
 */
function applyExceptionDatesSelection(exceptionDates) {
  syncerExceptionDatesSet = new Set();
  if (Array.isArray(exceptionDates)) {
    for (const date of exceptionDates) {
      const isoDate = String(date || "");
      if (isDateWithinRange(isoDate, syncerEventStartDate, syncerEventEndDate)) {
        syncerExceptionDatesSet.add(isoDate);
      }
    }
  }
  updateSyncerExceptionCalendarDayClasses();
}

/**
 * Affiche le calendrier de sélection des jours d'exception.
 *
 * @param {string} eventStartDate Date de début.
 * @param {string} eventEndDate Date de fin.
 * @param {Array<string>} exceptionDates Jours d'exception existants.
 */
function renderExceptionDatesCalendar(eventStartDate, eventEndDate, exceptionDates) {
  const pickerElement = document.getElementById("exception-dates-picker");
  if (!pickerElement) {
    return;
  }

  syncerEventStartDate = String(eventStartDate || "");
  syncerEventEndDate = String(eventEndDate || "");
  syncerExceptionDatesSet = new Set();

  if (!syncerEventStartDate || !syncerEventEndDate) {
    pickerElement.innerHTML = "<p>Configure d'abord la période de l'évènement.</p>";
    return;
  }

  if (!window.FullCalendar || !window.FullCalendar.Calendar) {
    pickerElement.innerHTML = "<p>Calendrier indisponible pour le moment.</p>";
    return;
  }

  pickerElement.innerHTML = "";
  const calendarRoot = document.createElement("div");
  calendarRoot.id = "syncer-exception-calendar";
  pickerElement.appendChild(calendarRoot);

  if (syncerExceptionCalendar) {
    syncerExceptionCalendar.destroy();
    syncerExceptionCalendar = null;
  }

  syncerExceptionCalendar = new window.FullCalendar.Calendar(calendarRoot, {
    initialView: "dayGridMonth",
    initialDate: syncerEventStartDate,
    locale: "fr",
    firstDay: 1,
    fixedWeekCount: true,
    ...getSyncMatesCalendarOptions(560),
    validRange: {
      start: syncerEventStartDate,
      end: addOneDayIso(syncerEventEndDate),
    },
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    datesSet: () => {
      requestAnimationFrame(() => {
        updateSyncerExceptionCalendarDayClasses();
      });
    },
    dayCellClassNames: (arg) => {
      const isoDate = formatDateLocalIso(arg.date);
      return [getSyncerExceptionDayClass(isoDate)];
    },
    dateClick: (info) => {
      const isoDate = info.dateStr;
      if (!isDateWithinRange(isoDate, syncerEventStartDate, syncerEventEndDate)) {
        return;
      }

      if (syncerExceptionDatesSet.has(isoDate)) {
        syncerExceptionDatesSet.delete(isoDate);
      } else {
        syncerExceptionDatesSet.add(isoDate);
      }

      updateSyncerExceptionCalendarDayClasses();
    },
  });

  syncerExceptionCalendar.render();
  bindSyncMatesResponsiveCalendar(syncerExceptionCalendar, 560);
  applyExceptionDatesSelection(exceptionDates);
}

/**
 * Enregistre les jours d'exception du synchroniseur.
 *
 * @param {string} currentSyncerId Identifiant du synchroniseur.
 * @param {Array<string>} exceptionDates Jours d'exception.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function saveExceptionDates(currentSyncerId, exceptionDates) {
  const response = await fetch(
    `/api/syncers/${encodeURIComponent(currentSyncerId)}/exception-dates`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exceptionDates,
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
    throw buildHttpError(
      `Erreur enregistrement exceptions (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

/**
 * Copie un texte dans le presse-papiers avec fallback navigateur.
 *
 * @param {string} text Texte à copier.
 * @returns {Promise<boolean>} true si copie réussie, false sinon.
 */
async function copyTextToClipboard(text) {
  if (!text) {
    return false;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      // On tentera le fallback juste après.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (_error) {
    success = false;
  }

  document.body.removeChild(textarea);
  return success;
}

/**
 * Met à jour l'affichage de la période d'évènement.
 *
 * @param {string} eventStartDate Date de début.
 * @param {string} eventEndDate Date de fin.
 */
function renderEventPeriod(eventStartDate, eventEndDate) {
  const periodElement = document.getElementById("syncer-event-period");
  if (!periodElement) {
    return;
  }

  if (!eventStartDate || !eventEndDate) {
    periodElement.textContent = "Non configurée";
    return;
  }

  periodElement.textContent = `Du ${formatHumanDateTime(eventStartDate)} au ${formatHumanDateTime(eventEndDate)}`;
}

/**
 * Pré-remplit le formulaire de période depuis les données synchroniseur.
 *
 * @param {string} eventStartDate Date de début.
 * @param {string} eventEndDate Date de fin.
 */
function hydrateEventPeriodForm(eventStartDate, eventEndDate) {
  const startInput = document.getElementById("event-start-date");
  const endInput = document.getElementById("event-end-date");
  if (!(startInput instanceof HTMLInputElement) || !(endInput instanceof HTMLInputElement)) {
    return;
  }

  startInput.value = eventStartDate || "";
  endInput.value = eventEndDate || "";
}

/**
 * Rend la liste des participants dans l'interface.
 *
 * @param {Array<Object>} participants Liste de participants.
 */
function renderParticipants(participants) {
  const participantsList = document.getElementById("participants-list");
  if (!participantsList) {
    return;
  }

  participantsList.innerHTML = "";
  if (!Array.isArray(participants) || participants.length === 0) {
    participantsList.innerHTML = "<li>Aucun participant pour le moment.</li>";
    return;
  }

  for (const participant of participants) {
    const item = document.createElement("li");
    const participantId = String(participant?.id || "");
    const participantName = String(participant?.name || "Participant");
    item.textContent = `${participantName} `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Supprimer";
    deleteButton.dataset.participantId = participantId;
    deleteButton.className = "delete-participant-button";

    item.appendChild(deleteButton);
    participantsList.appendChild(item);
  }
}

/**
 * Charge le détail d'un synchroniseur depuis l'API.
 *
 * @param {string} currentSyncerId Identifiant technique du synchroniseur.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function getSyncerDetails(currentSyncerId) {
  const response = await fetch(`/api/syncers/${encodeURIComponent(currentSyncerId)}`, {
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
    throw buildHttpError(
      `Erreur chargement synchroniseur (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

/**
 * Appelle l'API d'ajout de participant.
 *
 * @param {string} currentSyncerId Identifiant technique du synchroniseur.
 * @param {string} participantName Nom du participant.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function addParticipant(currentSyncerId, participantName) {
  const response = await fetch(`/api/syncers/${encodeURIComponent(currentSyncerId)}/participants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      participantName,
    }),
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
    throw buildHttpError(
      `Erreur ajout participant (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

/**
 * Appelle l'API de suppression de participant.
 *
 * @param {string} currentSyncerId Identifiant technique du synchroniseur.
 * @param {string} participantId Identifiant du participant à supprimer.
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function deleteParticipant(currentSyncerId, participantId) {
  const response = await fetch(
    `/api/syncers/${encodeURIComponent(currentSyncerId)}/participants/${encodeURIComponent(
      participantId
    )}`,
    {
      method: "DELETE",
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
    throw buildHttpError(
      `Erreur suppression participant (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

/**
 * Configure la plage de dates de l'évènement pour le synchroniseur.
 *
 * @param {string} currentSyncerId Identifiant technique du synchroniseur.
 * @param {string} eventStartDate Date de début (YYYY-MM-DD).
 * @param {string} eventEndDate Date de fin (YYYY-MM-DD).
 * @returns {Promise<Object>} Réponse JSON de l'API.
 * @throws {Error} Si la réponse API est en erreur.
 */
async function configureEventPeriod(currentSyncerId, eventStartDate, eventEndDate) {
  const response = await fetch(`/api/syncers/${encodeURIComponent(currentSyncerId)}/event-period`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventStartDate,
      eventEndDate,
    }),
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
    throw buildHttpError(
      `Erreur configuration période (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

// Initialisation de base depuis les params URL.
const syncerId = getQueryParam("id");
const syncerName = getQueryParam("name");
const syncerExpiresAt = getQueryParam("expiresAt");
const shareTokenFromUrl = getQueryParam("token");
const shareLinkButton = document.getElementById("share-link-button");
let currentShareLink = "";

if (syncerName) {
  setTextById("syncer-name", syncerName);
  setTextById("syncer-title", `Synchroniseur - ${syncerName}`);
}

if (syncerExpiresAt) {
  setTextById("syncer-expires-at", formatHumanDateTime(syncerExpiresAt));
}

if (syncerId) {
  getSyncerDetails(syncerId)
    .then((result) => {
      const syncer = result?.syncer || {};
      const participants = Array.isArray(syncer.participants) ? syncer.participants : [];
      renderParticipants(participants);
      const start = String(syncer.eventStartDate || "");
      const end = String(syncer.eventEndDate || "");
      const exceptionDates = Array.isArray(syncer.exceptionDates) ? syncer.exceptionDates : [];
      renderEventPeriod(start, end);
      hydrateEventPeriodForm(start, end);
      renderExceptionDatesCalendar(start, end, exceptionDates);

      // Si certaines infos manquent dans l'URL, on complète depuis l'API.
      if (!syncerName && syncer.name) {
        setTextById("syncer-name", String(syncer.name));
        setTextById("syncer-title", `Synchroniseur - ${String(syncer.name)}`);
      }
      if (!syncerExpiresAt && syncer.expiresAt) {
        setTextById("syncer-expires-at", formatHumanDateTime(String(syncer.expiresAt)));
      }

      const shareToken = String(syncer.shareToken || shareTokenFromUrl || "");
      const participantUrl = new URL("participant.html", window.location.href);
      participantUrl.searchParams.set("syncerId", syncerId);
      if (shareToken) {
        participantUrl.searchParams.set("token", shareToken);
      }
      currentShareLink = participantUrl.toString();
      setShareLinkFeedback("Lien de partage prêt à être copié.", false);
    })
    .catch((error) => {
      if (redirectToHostIfUnauthorized(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setAddParticipantFeedback(message, true);
      setShareLinkFeedback("Impossible de préparer le lien de partage.", true);
    });
}

// Gestion du formulaire d'ajout de participant.
const addParticipantForm = document.getElementById("add-participant-form");
const eventPeriodForm = document.getElementById("event-period-form");
const participantsList = document.getElementById("participants-list");
if (addParticipantForm) {
  addParticipantForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncerId) {
      setAddParticipantFeedback(
        "Impossible d'ajouter un participant sans identifiant de synchroniseur.",
        true
      );
      return;
    }

    const formData = new FormData(addParticipantForm);
    const participantName = String(formData.get("participantName") || "").trim();

    if (!participantName) {
      setAddParticipantFeedback("Le nom du participant est requis.", true);
      return;
    }

    setAddParticipantFeedback("Ajout en cours...", false);

    try {
      const result = await addParticipant(syncerId, participantName);
      const participants = Array.isArray(result?.syncer?.participants)
        ? result.syncer.participants
        : [];
      renderParticipants(participants);
      setAddParticipantFeedback("Participant ajouté avec succès.", false);
      addParticipantForm.reset();
    } catch (error) {
      if (redirectToHostIfUnauthorized(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setAddParticipantFeedback(message, true);
    }
  });
}

if (eventPeriodForm) {
  eventPeriodForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncerId) {
      setEventPeriodFeedback(
        "Impossible de configurer la période sans identifiant de synchroniseur.",
        true
      );
      return;
    }

    const formData = new FormData(eventPeriodForm);
    const eventStartDate = String(formData.get("eventStartDate") || "").trim();
    const eventEndDate = String(formData.get("eventEndDate") || "").trim();

    if (!eventStartDate || !eventEndDate) {
      setEventPeriodFeedback("La date de début et la date de fin sont requises.", true);
      return;
    }

    setEventPeriodFeedback("Enregistrement en cours...", false);

    try {
      const result = await configureEventPeriod(syncerId, eventStartDate, eventEndDate);
      const syncer = result?.syncer || {};
      const start = String(syncer.eventStartDate || eventStartDate);
      const end = String(syncer.eventEndDate || eventEndDate);
      renderEventPeriod(start, end);
      hydrateEventPeriodForm(start, end);
      const exceptionDates = Array.isArray(syncer.exceptionDates) ? syncer.exceptionDates : [];
      renderExceptionDatesCalendar(start, end, exceptionDates);
      setEventPeriodFeedback("Période configurée avec succès.", false);
    } catch (error) {
      if (redirectToHostIfUnauthorized(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setEventPeriodFeedback(message, true);
    }
  });
}

if (participantsList) {
  participantsList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.classList.contains("delete-participant-button")) {
      return;
    }

    const participantId = String(target.dataset.participantId || "");
    if (!syncerId || !participantId) {
      setAddParticipantFeedback("Suppression impossible: identifiant manquant.", true);
      return;
    }

    setAddParticipantFeedback("Suppression en cours...", false);

    try {
      const result = await deleteParticipant(syncerId, participantId);
      const participants = Array.isArray(result?.syncer?.participants)
        ? result.syncer.participants
        : [];
      renderParticipants(participants);
      setAddParticipantFeedback("Participant supprimé avec succès.", false);
    } catch (error) {
      if (redirectToHostIfUnauthorized(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setAddParticipantFeedback(message, true);
    }
  });
}

const saveExceptionDatesButton = document.getElementById("save-exception-dates-button");
if (saveExceptionDatesButton) {
  saveExceptionDatesButton.addEventListener("click", async () => {
    if (!syncerId) {
      setExceptionDatesFeedback("Impossible d'enregistrer sans identifiant de synchroniseur.", true);
      return;
    }

    if (!syncerEventStartDate || !syncerEventEndDate) {
      setExceptionDatesFeedback("Configure d'abord la période de l'évènement.", true);
      return;
    }

    const exceptionDates = Array.from(syncerExceptionDatesSet).sort();
    setExceptionDatesFeedback("Enregistrement en cours...", false);

    try {
      const result = await saveExceptionDates(syncerId, exceptionDates);
      const savedDates = Array.isArray(result?.syncer?.exceptionDates)
        ? result.syncer.exceptionDates
        : exceptionDates;
      applyExceptionDatesSelection(savedDates);
      setExceptionDatesFeedback("Indisponibilités organisateur enregistrées.", false);
    } catch (error) {
      if (redirectToHostIfUnauthorized(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setExceptionDatesFeedback(message, true);
    }
  });
}

if (shareLinkButton) {
  shareLinkButton.addEventListener("click", async () => {
    if (!currentShareLink) {
      setShareLinkFeedback("Aucun lien de partage disponible.", true);
      return;
    }

    const copied = await copyTextToClipboard(currentShareLink);
    if (copied) {
      setShareLinkFeedback("Lien de partage copié.", false);
      return;
    }

    setShareLinkFeedback(
      "Impossible de copier automatiquement. Copie manuelle: " + currentShareLink,
      true
    );
  });
}
