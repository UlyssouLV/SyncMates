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

