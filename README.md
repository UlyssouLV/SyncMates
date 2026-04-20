# SyncMates

Mini web app pour organiser facilement une date commune (barbecue, soirée, journée entre amis) en collectant les indisponibilités de chacun.

---

## Vision Produit (V1.0.0)

Un utilisateur (host) crée un "Syncer" (nom technique temporaire, renommable plus tard) avec :

- un nom de Syncer
- un mot de passe

Le Syncer est stocké pendant une durée limitée (48h en V1).  
Le host ajoute des participants par leur prénom/nom, puis partage un lien.  
Les participants sélectionnent leur profil et saisissent leurs dates d'indisponibilité.  
L'application affiche ensuite une vue synthétique :

- indisponibilités de tous
- plages où le plus de monde est disponible

Objectif V1 : valider le fonctionnement métier avant le design (HTML simple, CSS minimal).

---

## Fonctionnalités attendues V1.0.0

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
- Il renseigne ses indisponibilités (jour complet en V1 pour simplifier)

### 4) Visualisation des disponibilités
- Vue globale des indisponibilités
- Calcul des jours avec le meilleur score de disponibilité
- Affichage d'un classement des dates les plus favorables

### 5) Expiration des données
- Les Syncers expirés (>48h) ne sont plus exploitables
- Mécanisme de nettoyage des données expirées

### 6) Hors périmètre V1 (plus tard)
- Paiement 1 EUR pour prolonger 1 mois
- Design/UI avancé
- Notifications

---

## Choix techniques V1

- Frontend : HTML + JS (structure simple, pas de focus CSS)
- Backend : PHP 8+ (API simple sur hébergement Apache)
- Stockage : fichiers JSON (pas de base SQL en V1), avec 1 fichier par Syncer
- Sécurité : sessions serveur + cookie de session `HttpOnly` dès la V1

Pourquoi JSON en V1 :
- mise en place rapide
- facile à débugger
- cohérent avec un prototype métier

---

## Architecture de dossiers proposée

```txt
SyncMates/
  README.md
  public/
    index.html
    host.html
    participant.html
    result.html
    js/
      api.js
      host.js
      participant.js
      result.js
    api/
      index.php
  src/
    routes/
      syncers.php
    services/
      syncersService.php
      availabilityService.php
    storage/
      jsonStore.php
    utils/
      date.php
      id.php
  data/
    syncers/
      sync_abc123.json
      sync_def456.json
  .htaccess
```

---

## Modèle de données JSON (V1)

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
  "createdAt": "2026-04-20T10:00:00.000Z",
  "expiresAt": "2026-04-22T10:00:00.000Z",
  "shareToken": "token_123"
}
```

---

## Modèle de sécurité V1

La sécurité est incluse dès la V1 (pas reportée).

- **Host** : authentification par mot de passe, création d'une session côté serveur
- **Cookie de session** : `HttpOnly`, `Secure` (en HTTPS), `SameSite=Lax`, durée alignée sur l'expiration du Syncer
- **Participants** : accès via lien sécurisé contenant un `shareToken` non prévisible
- **Contrôle d'accès** : endpoints host accessibles uniquement avec session valide
- **Mots de passe** : stockés hashés (`password_hash` / `password_verify` en PHP)
- **Protection API** : validation stricte des entrées et vérification systématique de l'expiration 48h

---


## État actuel du projet

- Nom du repo défini : `SyncMates`
- Branche de travail créée : `1.0.0`
- Vision produit V1 clarifiée dans ce README
- Arborescence backend/frontend créée (`public`, `src`, `data`)
- Route API de création de Syncer implémentée : `POST /api/syncers`
- Stockage JSON opérationnel avec 1 fichier par Syncer (`data/syncers/{id}.json`)
- Validation de création en place (champs requis + JSON + Content-Type)
- Règle anti-doublon implémentée sur l'association `name + password`
- Formulaire "Créer un Syncer" branché côté frontend (`public/host.html` -> `public/js/host.js`)
- Routage Apache API en place via `public/.htaccess`

---

## Reste à développer (checklist V1.0.0)

- [x] Initialiser le projet PHP (`public`, `src`, `data`, `.htaccess`)
- [x] Créer l'architecture dossiers `public`, `src`, `data`
- [x] Implémenter le stockage JSON robuste (1 fichier par Syncer + lecture/écriture atomique)
- [ ] Compléter les endpoints Syncer + participants
- [ ] Implémenter auth host (mot de passe hashé + login + logout)
- [ ] Implémenter sessions serveur + cookie `HttpOnly`/`Secure`/`SameSite`
- [ ] Protéger les endpoints host par vérification de session
- [ ] Créer saisie d'indisponibilités côté participant
- [ ] Implémenter calcul "meilleures dates"
- [ ] Finaliser les pages HTML de base (sans style avancé)
- [ ] Gérer expiration 48h
- [ ] Ajouter validation d'entrées et gestion d'erreurs

---
