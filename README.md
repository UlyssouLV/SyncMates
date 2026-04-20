# SyncMates

Mini web app pour organiser facilement une date commune (barbecue, soirée, journée entre amis) en collectant les indisponibilités de chacun.

---

## Vision Produit 1.0.1

La version `1.0.1` est orientée **UI/CSS** pour améliorer le rendu global de la web app tout en conservant le périmètre métier/API actuel.

Objectifs principaux:

- Harmoniser le style global des pages (`index`, `host`, `syncer`, `participant`, `result`)
- Améliorer la lisibilité (typographie, espacements, hiérarchie visuelle)
- Améliorer l'ergonomie des formulaires, feedbacks et tableaux
- Uniformiser les composants (boutons, champs, cartes, sections)
- Ajouter un responsive de base (mobile/tablette/desktop)
- Conserver l'intégralité du comportement backend actuel

---

## Fonctionnalités actuelles

### 1) Création de Syncer
- Créer un Syncer avec `name` + `password`
- Générer un identifiant unique
- Enregistrer une date d'expiration à `now + 48h`

### 2) Gestion des participants (host)
- Ajouter des participants (ex: Jean, Louis, Greg)
- Lister / modifier / supprimer les participants
- Générer un lien partageable vers la page participant

### 3) Accès participant via lien
- Le participant ouvre le lien
- Il choisit son profil dans la liste créée par le host
- Il renseigne ses indisponibilités (jour complet pour simplifier)

### 4) Visualisation des disponibilités
- Vue globale des indisponibilités
- Calcul des jours avec le meilleur score de disponibilité
- Affichage d'un classement des dates les plus favorables

### 5) Expiration des données
- Les Syncers expirés (>48h) ne sont plus exploitables
- Mécanisme de nettoyage des données expirées (sessions)

### 6) Hors périmètre (plus tard)
- Paiement 1 EUR pour prolonger 1 mois
- Notifications

---

## Choix techniques

- Frontend : HTML + JS + CSS/UX
- Backend : PHP 8+ (API simple sur hébergement Apache)
- Stockage : fichiers JSON (pas de base SQL), avec 1 fichier par Syncer
- Sécurité : sessions serveur + cookie de session `HttpOnly`

---

## Architecture de dossiers 

```txt
SyncMates/
  README.md
  public/
    .htaccess
    index.html
    host.html
    syncer.html
    participant.html
    result.html
    js/
      maintenance.js
      host.js
      syncer.js
      participant.js
      result.js
    api/
      index.php
  src/
    routes/
      syncers.php
    services/
      maintenanceService.php
      syncersService.php
    storage/
      jsonStore.php
      sessionStore.php
    utils/
      date.php
      id.php
  data/
    syncers/
      sync_abc123.json
      sync_def456.json
    sessions/
      hs_xxx.json
    maintenance/
      cleanup-meta.json
      cleanup.lock
  scripts/
    cleanupExpiredSessions.php
    cleanupExpiredSyncers.php
  .htaccess
```

---

## Modèle de données JSON

Chaque Syncer est stocké dans son propre fichier JSON : `data/syncers/{syncerId}.json`

```json
{
  "id": "sync_abc123",
  "name": "Barbec Avril",
  "passwordHash": "hash",
  "host": {
    "name": "Ulysse"
  },
  "participants": [
    {
      "id": "p1",
      "name": "Jean",
      "unavailableDates": ["2026-04-24", "2026-04-25"]
    }
  ],
  "eventStartDate": "2026-05-01",
  "eventEndDate": "2026-06-30",
  "createdAt": "2026-04-20T10:00:00.000Z",
  "expiresAt": "2026-04-22T10:00:00.000Z",
  "shareToken": "token_123"
}
```

---

## Modèle de sécurité

La sécurité est incluse dans la version actuelle.

- **Host** : authentification par nom/ID + mot de passe
- **Session/Cookie** : session serveur JSON (`data/sessions/{sessionId}.json`) + cookie `host_session` (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS)
- **Participants** : accès via lien sécurisé contenant un `shareToken` non prévisible
- **Contrôle d'accès** : endpoints host protégés par vérification de session + association session/syncer
- **Mots de passe** : stockés hashés (`password_hash` / `password_verify` en PHP)
- **Protection API** : validation stricte des entrées et vérification systématique de l'expiration 48h

---

## API cible

- `POST /api/syncers` : créer un Syncer
- `POST /api/syncers/login` : connexion host à un Syncer existant
- `GET /api/syncers/{id}` : récupérer les détails d'un Syncer
- `GET /api/syncers/{id}/participants` : récupérer les profils participants d'un Syncer
- `POST /api/syncers/{id}/participants` : ajouter un participant
- `DELETE /api/syncers/{id}/participants/{participantId}` : supprimer un participant
- `GET /api/syncers/{id}/participants/{participantId}/unavailabilities` : charger les indisponibilités d'un participant
- `PATCH /api/syncers/{id}/participants/{participantId}/unavailabilities` : enregistrer les indisponibilités d'un participant
- `PATCH /api/syncers/{id}/event-period` : configurer la plage de l'évènement
- `GET /api/syncers/{id}/results` : récupérer les résultats agrégés de disponibilité
- `POST /api/maintenance/cleanup-if-needed` : déclencher le nettoyage opportuniste (delta 10 min)

---

## Reste à développer (checklist 1.0.1)

- [ ] Créer une feuille de style globale (`public/css/app.css`)
- [ ] Brancher la feuille de style sur `index.html`, `host.html`, `syncer.html`, `participant.html`, `result.html`
- [ ] Définir une charte visuelle simple (couleurs, typo, espacements, bordures, ombres)
- [ ] Uniformiser les composants (boutons, champs, labels, sections, cartes)
- [ ] Améliorer le rendu des formulaires (alignements, états focus, messages d'erreur/succès)
- [ ] Améliorer le rendu des listes participants et du tableau de résultats
- [ ] Structurer une grille responsive de base (mobile/tablette/desktop)
- [ ] Vérifier la cohérence visuelle et l'accessibilité de base (contraste, lisibilité, focus visible)
- [ ] Nettoyer les éléments temporaires ou incohérents de l'UI (textes, sections, placeholders)

---

