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
    throw new Error(
      `Erreur chargement Syncer (${response.status} ${response.statusText}) - ${details}`
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
    throw new Error(
      `Erreur ajout participant (${response.status} ${response.statusText}) - ${details}`
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
    throw new Error(
      `Erreur suppression participant (${response.status} ${response.statusText}) - ${details}`
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
    throw new Error(
      `Erreur configuration période (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

// Initialisation de base depuis les params URL.
const syncerId = getQueryParam("id");
const syncerName = getQueryParam("name");
const syncerExpiresAt = getQueryParam("expiresAt");

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
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setAddParticipantFeedback(message, true);
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
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setAddParticipantFeedback(message, true);
    }
  });
}
