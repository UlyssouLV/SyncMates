<?php

declare(strict_types=1);

/**
 * Couche de stockage JSON des Syncers.
 *
 * Ce fichier encapsule les opérations disque:
 * - résolution des chemins,
 * - création des dossiers,
 * - écriture JSON verrouillée,
 * - vérification d'existence des Syncers,
 * - recherche de Syncers existants pour éviter les doublons métier.
 */

/**
 * Retourne le dossier contenant les fichiers Syncer JSON.
 */
function syncersDataDirectory(): string
{
    return __DIR__ . '/../../data/syncers';
}

/**
 * Crée le dossier de stockage s'il n'existe pas encore.
 */
function ensureSyncersDataDirectoryExists(): void
{
    $dir = syncersDataDirectory();
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

/**
 * Construit le chemin absolu du fichier JSON d'un Syncer.
 *
 * @param string $syncerId Identifiant du Syncer.
 */
function syncerFilePath(string $syncerId): string
{
    return syncersDataDirectory() . '/' . $syncerId . '.json';
}

/**
 * Sauvegarde un Syncer dans son fichier JSON dédié.
 *
 * @param array $syncer Structure complète du Syncer (doit contenir id).
 *
 * @throws RuntimeException Si l'ID est invalide ou en cas d'erreur disque.
 */
function saveSyncer(array $syncer): void
{
    // Garantit l'existence du dossier data/syncers.
    ensureSyncersDataDirectoryExists();

    $syncerId = $syncer['id'] ?? '';
    if (!is_string($syncerId) || $syncerId === '') {
        throw new RuntimeException('Identifiant Syncer invalide.');
    }

    $path = syncerFilePath($syncerId);

    // Sérialise avec un format lisible pour faciliter le debug.
    $json = json_encode($syncer, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible de sérialiser le Syncer.');
    }

    // Écriture verrouillée pour limiter les conflits concurrents.
    $bytes = file_put_contents($path, $json, LOCK_EX);
    if ($bytes === false) {
        throw new RuntimeException('Impossible d\'enregistrer le Syncer.');
    }
}

/**
 * Indique si un fichier Syncer existe déjà pour l'ID donné.
 */
function syncerExists(string $syncerId): bool
{
    return file_exists(syncerFilePath($syncerId));
}

/**
 * Recherche un Syncer ayant la même association name + password.
 *
 * Le mot de passe étant stocké hashé, la vérification se fait avec
 * password_verify sur chaque hash correspondant au nom demandé.
 *
 * @param string $name     Nom du Syncer à vérifier.
 * @param string $password Mot de passe brut saisi.
 *
 * @return array|null Retourne le Syncer trouvé, sinon null.
 */
function findSyncerByNameAndPassword(string $name, string $password): ?array
{
    ensureSyncersDataDirectoryExists();

    $pattern = syncersDataDirectory() . '/*.json';
    $paths = glob($pattern);
    if (!is_array($paths)) {
        return null;
    }

    foreach ($paths as $path) {
        $raw = file_get_contents($path);
        if (!is_string($raw) || $raw === '') {
            continue;
        }

        $syncer = json_decode($raw, true);
        if (!is_array($syncer)) {
            continue;
        }

        $existingName = isset($syncer['name']) ? (string) $syncer['name'] : '';
        $existingPasswordHash = isset($syncer['passwordHash']) ? (string) $syncer['passwordHash'] : '';
        if ($existingName === '' || $existingPasswordHash === '') {
            continue;
        }

        // Même nom + mot de passe qui matche le hash => association déjà existante.
        if ($existingName === $name && password_verify($password, $existingPasswordHash)) {
            return $syncer;
        }
    }

    return null;
}

