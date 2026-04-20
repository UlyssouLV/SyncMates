/**
 * Script frontend de maintenance opportuniste.
 *
 * Au chargement de page, ce script appelle un endpoint backend qui
 * déclenche les nettoyages (sessions/syncers expirés) uniquement si
 * le delta minimal depuis le dernier run est dépassé.
 */
(function triggerMaintenanceCleanup() {
  fetch("/api/maintenance/cleanup-if-needed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    keepalive: true,
  })
    .then(async (response) => {
      // Expose le dernier statut pour vérification rapide.
      window.__syncmatesMaintenanceStatus = {
        ok: response.ok,
        status: response.status,
        checkedAt: new Date().toISOString(),
      };

      if (!response.ok) {
        const raw = await response.text();
        console.warn(
          "[maintenance] cleanup-if-needed en erreur:",
          response.status,
          raw || "(sans détail)"
        );
        return;
      }

      console.info("[maintenance] cleanup-if-needed vérifié (HTTP 200).");
    })
    .catch((error) => {
      console.warn("[maintenance] appel impossible:", error);
      // Échec silencieux côté UI: la maintenance ne doit pas bloquer l'application.
      window.__syncmatesMaintenanceStatus = {
        ok: false,
        status: 0,
        checkedAt: new Date().toISOString(),
      };
  });
})();
