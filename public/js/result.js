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
 * Affiche un feedback utilisateur.
 *
 * @param {string} message Message à afficher.
 * @param {boolean} isError Indique si c'est une erreur.
 */
function setResultsFeedback(message, isError) {
  const feedbackElement = document.getElementById("results-feedback");
  if (!feedbackElement) {
    return;
  }
  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
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
    setTextById("syncer-period", `Du ${eventStartDate} au ${eventEndDate}`);
  }
  setTextById("participants-count", String(participantsCount || 0));
}

/**
 * Rend la liste des meilleures dates.
 *
 * @param {Array<Object>} bestDates Top des dates.
 */
function renderBestDates(bestDates) {
  const listElement = document.getElementById("best-dates-list");
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";
  if (!Array.isArray(bestDates) || bestDates.length === 0) {
    listElement.innerHTML = "<li>Aucune date recommandée pour le moment.</li>";
    return;
  }

  for (const dateItem of bestDates) {
    const li = document.createElement("li");
    const date = String(dateItem?.date || "-");
    const availableCount = Number(dateItem?.availableCount || 0);
    const unavailableCount = Number(dateItem?.unavailableCount || 0);
    const availabilityRate = Number(dateItem?.availabilityRate || 0);
    li.textContent = `${date} - ${availableCount} dispo / ${unavailableCount} indispo (${availabilityRate}%)`;
    listElement.appendChild(li);
  }
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
    tableBody.innerHTML = "<tr><td colspan=\"4\">Aucune donnée de disponibilité à afficher.</td></tr>";
    return;
  }

  for (const row of dailyAvailability) {
    const tr = document.createElement("tr");

    const date = String(row?.date || "-");
    const availableCount = Number(row?.availableCount || 0);
    const unavailableCount = Number(row?.unavailableCount || 0);
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

  listElement.innerHTML = "";
  if (!Array.isArray(participants) || participants.length === 0) {
    listElement.innerHTML = "<li>Aucun participant pour le moment.</li>";
    return;
  }

  for (const participant of participants) {
    const li = document.createElement("li");
    const name = String(participant?.name || "Participant");
    const unavailableDates = Array.isArray(participant?.unavailableDates)
      ? participant.unavailableDates
      : [];
    li.textContent = `${name} - ${unavailableDates.length} indisponibilité(s)`;
    listElement.appendChild(li);
  }
}

/**
 * Charge et rend tous les blocs de la page résultat.
 */
async function loadResults() {
  const syncerId = getQueryParam("syncerId");
  if (!syncerId) {
    setResultsFeedback("Paramètre syncerId manquant dans l'URL.", true);
    return;
  }

  setResultsFeedback("Chargement des résultats...", false);

  try {
    const response = await fetchSyncerResults(syncerId);
    const results = response?.results || {};

    renderSyncerHeader(results.syncer || {}, Number(results.participantsCount || 0));
    renderBestDates(Array.isArray(results.bestDates) ? results.bestDates : []);
    renderDailyAvailabilityTable(
      Array.isArray(results.dailyAvailability) ? results.dailyAvailability : []
    );
    renderParticipantsSummary(Array.isArray(results.participants) ? results.participants : []);

    setResultsFeedback("Résultats chargés.", false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    setResultsFeedback(message, true);
  }
}

const refreshButton = document.getElementById("refresh-results-button");
if (refreshButton) {
  refreshButton.addEventListener("click", () => {
    loadResults();
  });
}

loadResults();

