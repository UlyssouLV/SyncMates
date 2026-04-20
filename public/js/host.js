/**
 * Script frontend de la page host.
 *
 * Ce fichier gère le formulaire "Créer un Syncer":
 * - récupération des champs utilisateur,
 * - appel de l'API de création,
 * - gestion des retours succès/erreur dans l'UI.
 */
const createSyncerForm = document.getElementById("create-syncer-form");
const feedbackElement = document.getElementById("create-syncer-feedback");

/**
 * Affiche un message de retour utilisateur dans la page.
 *
 * @param {string} message Texte à afficher.
 * @param {boolean} isError Indique si le message est une erreur.
 */
function setFeedback(message, isError) {
  if (!feedbackElement) {
    return;
  }

  // Met à jour le contenu et la couleur du message de feedback.
  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "crimson" : "green";
}

/**
 * Appelle l'API backend pour créer un nouveau Syncer.
 *
 * @param {string} name Nom du Syncer.
 * @param {string} password Mot de passe du Syncer.
 * @returns {Promise<Object>} Réponse JSON du backend.
 * @throws {Error} Si la réponse HTTP n'est pas en succès.
 */
async function createSyncer(name, password) {
  const response = await fetch("/api/syncers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      password,
    }),
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
      `Erreur création Syncer (${response.status} ${response.statusText}) - ${details}`
    );
  }

  return data;
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
      setFeedback("Le nom et le mot de passe sont obligatoires.", true);
      return;
    }

    // Informe l'utilisateur que la requête est en cours.
    setFeedback("Création en cours...", false);

    try {
      const result = await createSyncer(name, password);
      const syncerId = result?.syncer?.id || "(id indisponible)";
      // Retour visuel en succès + reset du formulaire.
      setFeedback(`Syncer créé avec succès. ID: ${syncerId}`, false);
      createSyncerForm.reset();
    } catch (error) {
      // Retour visuel en erreur avec message explicite.
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setFeedback(message, true);
    }
  });
}

