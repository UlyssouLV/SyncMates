<?php

declare(strict_types=1);

/**
 * Service métier des Syncers.
 *
 * Ce fichier contient la logique métier pure:
 * - validation fonctionnelle des entrées,
 * - génération des identifiants et métadonnées,
 * - hash du mot de passe,
 * - persistance du Syncer.
 */
require_once __DIR__ . '/../storage/jsonStore.php';
require_once __DIR__ . '/../utils/date.php';
require_once __DIR__ . '/../utils/id.php';

/**
 * Crée un Syncer et l'enregistre dans le stockage JSON.
 *
 * @param string $name     Nom utilisateur du Syncer.
 * @param string $password Mot de passe brut saisi par le host.
 *
 * @return array Syncer créé, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les entrées sont invalides.
 * @throws RuntimeException         Si une erreur de génération/stockage survient.
 */
function createSyncer(string $name, string $password): array
{
    // Nettoie le nom pour éviter les espaces seuls.
    $trimmedName = trim($name);
    if ($trimmedName === '') {
        throw new InvalidArgumentException('Le nom du Syncer est requis.');
    }

    if ($password === '') {
        throw new InvalidArgumentException('Le mot de passe est requis.');
    }

    // Empêche la création si l'association name + password existe déjà.
    $existingSyncer = findSyncerByNameAndPassword($trimmedName, $password);
    if (is_array($existingSyncer)) {
        throw new DomainException('Un Syncer avec ce nom et ce mot de passe existe déjà.');
    }

    // Génère un ID et évite les collisions disque.
    $syncerId = generateSyncerId();
    $attempts = 0;
    while (syncerExists($syncerId) && $attempts < 5) {
        $syncerId = generateSyncerId();
        $attempts++;
    }

    if (syncerExists($syncerId)) {
        throw new RuntimeException('Collision d\'identifiant Syncer.');
    }

    // Prépare la structure persistée côté serveur.
    $syncer = [
        'id' => $syncerId,
        'name' => $trimmedName,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'host' => [
            'name' => 'Host',
        ],
        'participants' => [],
        'createdAt' => nowIso8601(),
        'expiresAt' => expiresInHoursIso8601(48),
        'shareToken' => generateShareToken(),
    ];

    // Persiste le Syncer dans data/syncers/{id}.json.
    saveSyncer($syncer);

    // Ne jamais exposer le hash dans la réponse API.
    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Authentifie un host sur un Syncer existant.
 *
 * @param string $identifier Identifiant saisi (ID technique ou nom du Syncer).
 * @param string $password   Mot de passe brut saisi par le host.
 *
 * @return array Syncer authentifié, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les entrées sont invalides.
 * @throws DomainException          Si l'authentification échoue.
 */
function loginSyncer(string $identifier, string $password): array
{
    $trimmedIdentifier = trim($identifier);
    if ($trimmedIdentifier === '') {
        throw new InvalidArgumentException('Le nom ou identifiant du Syncer est requis.');
    }

    if ($password === '') {
        throw new InvalidArgumentException('Le mot de passe est requis.');
    }

    $syncer = findSyncerForLogin($trimmedIdentifier, $password);
    if (!is_array($syncer)) {
        throw new DomainException('Identifiants de connexion invalides.');
    }

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Ajoute un participant à un Syncer existant.
 *
 * @param string $syncerId        Identifiant technique du Syncer.
 * @param string $participantName Nom du participant à ajouter.
 *
 * @return array Syncer mis à jour, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les paramètres sont invalides.
 * @throws DomainException          Si ressource invalide.
 */
function addParticipantToSyncer(string $syncerId, string $participantName): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedParticipantName = trim($participantName);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    if ($trimmedParticipantName === '') {
        throw new InvalidArgumentException('Le nom du participant est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    foreach ($participants as $participant) {
        $existingName = isset($participant['name']) ? (string) $participant['name'] : '';
        if ($existingName !== '' && strtolower($existingName) === strtolower($trimmedParticipantName)) {
            throw new DomainException('Un participant avec ce nom existe déjà.');
        }
    }

    $participants[] = [
        'id' => generateParticipantId(),
        'name' => $trimmedParticipantName,
        'unavailableDates' => [],
    ];

    $syncer['participants'] = $participants;
    saveSyncer($syncer);

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Retourne le détail d'un Syncer par son identifiant.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 *
 * @return array Syncer trouvé, sans passwordHash.
 *
 * @throws InvalidArgumentException Si l'identifiant est vide.
 * @throws DomainException          Si le Syncer n'existe pas.
 */
function getSyncerDetails(string $syncerId): array
{
    $trimmedSyncerId = trim($syncerId);
    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    unset($syncer['passwordHash']);
    return $syncer;
}

