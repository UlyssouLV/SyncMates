/**
 * Script frontend de la page syncer.
 *
 * Ce fichier initialise un affichage minimal du Syncer apres connexion.
 * En attendant l'endpoint de detail, il lit les informations passees
 * dans l'URL (query params) pour afficher une vue de base.
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

// Initialisation minimale de la page depuis les params URL.
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
