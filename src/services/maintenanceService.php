<?php

declare(strict_types=1);

/**
 * Service de maintenance applicative.
 *
 * Ce service déclenche le nettoyage des sessions et Syncers expirés
 * à intervalle régulé (delta minimal) avec verrou fichier pour éviter
 * les exécutions concurrentes.
 */
require_once __DIR__ . '/../../scripts/cleanupExpiredSessions.php';
require_once __DIR__ . '/../../scripts/cleanupExpiredSyncers.php';

const CLEANUP_META_PATH = __DIR__ . '/../../data/maintenance/cleanup-meta.json';
const CLEANUP_LOCK_PATH = __DIR__ . '/../../data/maintenance/cleanup.lock';

/**
 * Exécute les nettoyages uniquement si le délai minimal est dépassé.
 *
 * @param int $deltaSeconds Délai minimal entre deux nettoyages.
 *
 * @return array{
 *   ran:bool,
 *   deltaSeconds:int,
 *   lastCleanupAt:string|null,
 *   now:string,
 *   sessions?:array,
 *   syncers?:array
 * }
 */
function runCleanupIfNeeded(int $deltaSeconds = 600): array
{
    ensureMaintenanceDirectoryExists();

    $lockHandle = fopen(CLEANUP_LOCK_PATH, 'c+');
    if ($lockHandle === false) {
        throw new RuntimeException('Impossible d\'ouvrir le fichier de verrou de maintenance.');
    }

    try {
        if (!flock($lockHandle, LOCK_EX)) {
            throw new RuntimeException('Impossible de verrouiller la maintenance.');
        }

        $meta = readCleanupMeta();
        $lastCleanupAt = isset($meta['lastCleanupAt']) ? (string) $meta['lastCleanupAt'] : '';
        $lastCleanupTimestamp = $lastCleanupAt !== '' ? strtotime($lastCleanupAt) : false;
        $nowTimestamp = time();

        $shouldRun = true;
        if ($lastCleanupTimestamp !== false) {
            $shouldRun = ($nowTimestamp - $lastCleanupTimestamp) >= $deltaSeconds;
        }

        if (!$shouldRun) {
            return [
                'ran' => false,
                'deltaSeconds' => $deltaSeconds,
                'lastCleanupAt' => $lastCleanupAt !== '' ? $lastCleanupAt : null,
                'now' => gmdate('c', $nowTimestamp),
            ];
        }

        // Met à jour la date avant exécution pour éviter les doubles runs.
        $nowIso = gmdate('c', $nowTimestamp);
        writeCleanupMeta([
            'lastCleanupAt' => $nowIso,
        ]);

        $sessionsResult = cleanupExpiredSessions();
        $syncersResult = cleanupExpiredSyncers();

        return [
            'ran' => true,
            'deltaSeconds' => $deltaSeconds,
            'lastCleanupAt' => $nowIso,
            'now' => $nowIso,
            'sessions' => $sessionsResult,
            'syncers' => $syncersResult,
        ];
    } finally {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
}

/**
 * Retourne le dossier `data/maintenance`.
 */
function maintenanceDirectory(): string
{
    return __DIR__ . '/../../data/maintenance';
}

/**
 * Crée le dossier `data/maintenance` si nécessaire.
 */
function ensureMaintenanceDirectoryExists(): void
{
    $dir = maintenanceDirectory();
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

/**
 * Lit les métadonnées de maintenance.
 *
 * @return array Tableau meta JSON.
 */
function readCleanupMeta(): array
{
    if (!file_exists(CLEANUP_META_PATH)) {
        return [];
    }

    $raw = file_get_contents(CLEANUP_META_PATH);
    if (!is_string($raw) || $raw === '') {
        return [];
    }

    $meta = json_decode($raw, true);
    if (!is_array($meta)) {
        return [];
    }

    return $meta;
}

/**
 * Écrit les métadonnées de maintenance avec verrou disque.
 *
 * @param array $meta Données méta à persister.
 */
function writeCleanupMeta(array $meta): void
{
    $json = json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible de sérialiser les métadonnées de maintenance.');
    }

    $written = file_put_contents(CLEANUP_META_PATH, $json, LOCK_EX);
    if ($written === false) {
        throw new RuntimeException('Impossible d\'écrire les métadonnées de maintenance.');
    }
}
