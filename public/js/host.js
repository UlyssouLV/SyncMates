/**
 * Script frontend de la page host.
 *
 * Ce fichier gère:
 * - le formulaire de connexion synchroniseur,
 * - récupération des champs utilisateur,
 * - appel des API de connexion et de création,
 * - gestion des retours succès/erreur dans l'UI.
 */
const hostLoginForm = document.getElementById("host-login-form");
const createSyncerForm = document.getElementById("create-syncer-form");
const hostLoginFeedbackElement = document.getElementById("host-login-feedback");
const createSyncerFeedbackElement = document.getElementById("create-syncer-feedback");

/**
 * Affiche un message de retour utilisateur dans la page.
 *
 * @param {HTMLElement|null} targetElement Element de destination du feedback.
 * @param {string} message Texte à afficher.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setFeedback(targetElement, message, isError) {
  if (!targetElement) {
    return;
  }

  // Met à jour le contenu et la couleur du message de feedback.
  targetElement.textContent = message;
  targetElement.style.color = isError ? "crimson" : "green";
}

/**
 * Appelle une route API JSON et centralise la gestion des erreurs HTTP.
 *
 * @param {string} endpoint Route API cible.
 * @param {Object} payload Données JSON envoyées.
 * @param {string} actionLabel Libellé de l'action pour les messages d'erreur.
 * @returns {Promise<Object>} Réponse JSON du backend.
 * @throws {Error} Si la réponse HTTP n'est pas en succès.
 */
async function postJson(endpoint, payload, actionLabel) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Lit d'abord la réponse brute pour gérer proprement JSON et non-JSON.
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
      `Erreur ${actionLabel} (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
}

/**
 * Appelle l'API backend pour créer un nouveau synchroniseur.
 *
 * @param {string} name Nom du synchroniseur.
 * @param {string} password Mot de passe du synchroniseur.
 * @returns {Promise<Object>} Réponse JSON du backend.
 */
async function createSyncer(name, password) {
  return postJson("/api/syncers", { name, password }, "création synchroniseur");
}

/**
 * Appelle l'API backend pour connecter un hôte à un synchroniseur existant.
 *
 * @param {string} identifier Nom ou identifiant du synchroniseur.
 * @param {string} password Mot de passe du synchroniseur.
 * @returns {Promise<Object>} Réponse JSON du backend.
 */
async function loginSyncer(identifier, password) {
  return postJson(
    "/api/syncers/login",
    { identifier, password },
    "connexion synchroniseur"
  );
}

if (hostLoginForm) {
  hostLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(hostLoginForm);
    const identifier = String(formData.get("syncerName") || "").trim();
    const password = String(formData.get("syncerPassword") || "");

    if (!identifier || !password) {
      setFeedback(
        hostLoginFeedbackElement,
        "Le nom/identifiant et le mot de passe sont obligatoires.",
        true
      );
      return;
    }

    setFeedback(hostLoginFeedbackElement, "Connexion en cours...", false);

    try {
      const result = await loginSyncer(identifier, password);
      const syncer = result?.syncer || {};
      const syncerId = String(syncer.id || "");
      const syncerName = String(syncer.name || "");
      const syncerExpiresAt = String(syncer.expiresAt || "");

      setFeedback(hostLoginFeedbackElement, "Connexion réussie.", false);

      const targetUrl = new URL("syncer.html", window.location.href);
      targetUrl.searchParams.set("id", syncerId);
      targetUrl.searchParams.set("name", syncerName);
      targetUrl.searchParams.set("expiresAt", syncerExpiresAt);
      window.location.href = targetUrl.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setFeedback(hostLoginFeedbackElement, message, true);
    }
  });
}

if (createSyncerForm) {
  createSyncerForm.addEventListener("submit", async (event) => {
    // Empêche la soumission HTML classique pour gérer le flux en JavaScript.
    event.preventDefault();

    const formData = new FormData(createSyncerForm);
    const name = String(formData.get("createSyncerName") || "").trim();
    const password = String(formData.get("createSyncerPassword") || "");

    // Validation minimale côté client avant appel API.
    if (!name || !password) {
      setFeedback(
        createSyncerFeedbackElement,
        "Le nom et le mot de passe sont obligatoires.",
        true
      );
      return;
    }

    // Informe l'utilisateur que la requête est en cours.
    setFeedback(createSyncerFeedbackElement, "Création en cours...", false);

    try {
      const result = await createSyncer(name, password);
      const syncerId = result?.syncer?.id || "(id indisponible)";
      // Retour visuel en succès + reset du formulaire.
      setFeedback(
        createSyncerFeedbackElement,
        `Synchroniseur créé avec succès. ID: ${syncerId}`,
        false
      );
      createSyncerForm.reset();
    } catch (error) {
      // Retour visuel en erreur avec message explicite.
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setFeedback(createSyncerFeedbackElement, message, true);
    }
  });
}

