/**
 * Script frontend de la page participant.
 *
 * Ce fichier:
 * - récupère le syncerId depuis l'URL,
 * - charge les profils participants via l'API,
 * - alimente le select de sélection de profil,
 * - affiche les informations du Syncer.
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

  setTextById("syncer-period", `Du ${eventStartDate} au ${eventEndDate}`);
}

const syncerId = getQueryParam("syncerId");
const participantSelectionForm = document.getElementById("participant-selection-form");
const participantSelect = document.getElementById("participant-select");

if (!syncerId) {
  setSelectionFeedback("Lien invalide: paramètre syncerId manquant.", true);
} else {
  fetchSyncerParticipants(syncerId)
    .then((result) => {
      const syncer = result?.syncer || {};
      const participants = Array.isArray(syncer.participants) ? syncer.participants : [];

      setTextById("syncer-name", String(syncer.name || "-"));
      renderSyncerPeriod(syncer.eventStartDate || null, syncer.eventEndDate || null);
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
  participantSelectionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const selectedOption = participantSelect.selectedOptions[0];
    if (!selectedOption || !participantSelect.value) {
      setSelectionFeedback("Merci de choisir un profil.", true);
      return;
    }

    setTextById("selected-participant-name", selectedOption.textContent || "-");
    setSelectionFeedback("Profil sélectionné.", false);
  });
}

