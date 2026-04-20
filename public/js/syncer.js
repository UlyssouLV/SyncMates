/**
 * Script frontend de la page syncer.
 *
 * Ce fichier initialise un affichage minimal du Syncer apres connexion.
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

  periodElement.textContent = `Du ${eventStartDate} au ${eventEndDate}`;
}

/**
 * Pré-remplit le formulaire de période depuis les données Syncer.
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
 * Charge le détail d'un Syncer depuis l'API.
 *
 * @param {string} currentSyncerId Identifiant technique du Syncer.
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
      `Erreur chargement Syncer (${response.status} ${response.statusText}) - ${details}`,
      response.status
    );
  }

  return data;
}

/**
 * Appelle l'API d'ajout de participant.
 *
 * @param {string} currentSyncerId Identifiant technique du Syncer.
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
 * @param {string} currentSyncerId Identifiant technique du Syncer.
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
 * Configure la plage de dates de l'évènement pour le Syncer.
 *
 * @param {string} currentSyncerId Identifiant technique du Syncer.
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

if (syncerId) {
  setTextById("syncer-id", syncerId);
}

if (syncerName) {
  setTextById("syncer-name", syncerName);
  setTextById("syncer-title", `Syncer - ${syncerName}`);
}

if (syncerExpiresAt) {
  setTextById("syncer-expires-at", syncerExpiresAt);
}

if (syncerId) {
  getSyncerDetails(syncerId)
    .then((result) => {
      const syncer = result?.syncer || {};
      const participants = Array.isArray(syncer.participants) ? syncer.participants : [];
      renderParticipants(participants);
      renderEventPeriod(String(syncer.eventStartDate || ""), String(syncer.eventEndDate || ""));
      hydrateEventPeriodForm(String(syncer.eventStartDate || ""), String(syncer.eventEndDate || ""));

      // Si certaines infos manquent dans l'URL, on complète depuis l'API.
      if (!syncerName && syncer.name) {
        setTextById("syncer-name", String(syncer.name));
        setTextById("syncer-title", `Syncer - ${String(syncer.name)}`);
      }
      if (!syncerExpiresAt && syncer.expiresAt) {
        setTextById("syncer-expires-at", String(syncer.expiresAt));
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
        "Impossible d'ajouter un participant sans identifiant de Syncer.",
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
        "Impossible de configurer la période sans identifiant de Syncer.",
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
