<?php

declare(strict_types=1);

/**
 * Script CLI de nettoyage des Syncers expirés.
 *
 * Ce script parcourt tous les fichiers `data/syncers/*.json` et supprime:
 * - les Syncers invalides (JSON illisible, id manquant, expiresAt invalide),
 * - les Syncers dont `expiresAt` est dépassé.
 *
 * Usage:
 *   php scripts/cleanupExpiredSyncers.php
 */
require_once __DIR__ . '/../src/storage/jsonStore.php';

/**
 * Vérifie si un Syncer est expiré à partir de son champ expiresAt.
 *
 * @param array $syncer Données JSON du Syncer.
 */
function isSyncerExpired(array $syncer): bool
{
    $expiresAt = isset($syncer['expiresAt']) ? (string) $syncer['expiresAt'] : '';
    if ($expiresAt === '') {
        return true;
    }

    $expiresAtTimestamp = strtotime($expiresAt);
    if ($expiresAtTimestamp === false) {
        return true;
    }

    return $expiresAtTimestamp < time();
}

/**
 * Nettoie les Syncers expirés/invalides et retourne un bilan.
 *
 * @return array{scanned:int,deleted:int,kept:int,errors:int}
 */
function cleanupExpiredSyncers(): array
{
    ensureSyncersDataDirectoryExists();

    $paths = glob(syncersDataDirectory() . '/*.json');
    if (!is_array($paths)) {
        return [
            'scanned' => 0,
            'deleted' => 0,
            'kept' => 0,
            'errors' => 1,
        ];
    }

    $scanned = 0;
    $deleted = 0;
    $kept = 0;
    $errors = 0;

    foreach ($paths as $path) {
        $scanned++;

        $syncer = readSyncerFromPath($path);
        if (!is_array($syncer)) {
            if (@unlink($path) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        $syncerId = isset($syncer['id']) ? (string) $syncer['id'] : '';
        if ($syncerId === '') {
            if (@unlink($path) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        if (isSyncerExpired($syncer)) {
            $syncerPath = syncerFilePath($syncerId);
            if (@unlink($syncerPath) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        $kept++;
    }

    return [
        'scanned' => $scanned,
        'deleted' => $deleted,
        'kept' => $kept,
        'errors' => $errors,
    ];
}

if (PHP_SAPI === 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    $result = cleanupExpiredSyncers();
    echo json_encode([
        'message' => 'Nettoyage des Syncers terminé.',
        'result' => $result,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
