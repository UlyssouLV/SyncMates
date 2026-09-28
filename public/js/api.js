/**
 * Helpers d'appel API partagés.
 *
 * Les pages vivent dans public/ : les URLs sont résolues depuis la page
 * courante, pour que /sous-dossier/host.html appelle le bon /sous-dossier/api.
 */

/**
 * Construit l'URL d'une route API à partir de la page courante.
 *
 * @param {string} path Chemin API, avec ou sans slash initial.
 * @returns {string} URL absolue résolue.
 */
function apiUrl(path) {
  const relativePath = String(path || "").replace(/^\//, "");
  return new URL(relativePath, document.baseURI).href;
}

/**
 * Sérialise un payload JSON sans apostrophe ASCII.
 *
 * Sur beaucoup d'hébergements Apache, mod_security répond 404
 * (page HTML « Not Found ») dès qu'un POST contient un « ' »,
 * comme dans « l'EPF ». L'apostrophe typographique passe, et le
 * backend la réécrit en apostrophe ASCII avant stockage.
 *
 * @param {Object} payload Données à envoyer.
 * @returns {string} Corps JSON.
 */
function stringifyApiBody(payload) {
  return JSON.stringify(payload).replace(/'/g, "\u2019");
}
