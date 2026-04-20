<?php

declare(strict_types=1);

/**
 * Script CLI de nettoyage des sessions host expirées.
 *
 * Ce script parcourt tous les fichiers `data/sessions/*.json` et supprime:
 * - les sessions invalides (JSON illisible, sessionId manquant, expiresAt invalide),
 * - les sessions dont `expiresAt` est dépassé.
 *
 * Usage:
 *   php scripts/cleanupExpiredSessions.php
 */
require_once __DIR__ . '/../src/storage/sessionStore.php';

/**
 * Vérifie si une session est expirée à partir de son champ expiresAt.
 *
 * @param array $session Données JSON de session.
 */
function isSessionExpired(array $session): bool
{
    $expiresAt = isset($session['expiresAt']) ? (string) $session['expiresAt'] : '';
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
 * Nettoie les sessions expirées/invalides et retourne un bilan.
 *
 * @return array{scanned:int,deleted:int,kept:int,errors:int}
 */
function cleanupExpiredSessions(): array
{
    ensureSessionsDataDirectoryExists();

    $paths = glob(sessionsDataDirectory() . '/*.json');
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

        $raw = file_get_contents($path);
        if (!is_string($raw) || $raw === '') {
            if (@unlink($path) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        $session = json_decode($raw, true);
        if (!is_array($session)) {
            if (@unlink($path) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        $sessionId = isset($session['sessionId']) ? (string) $session['sessionId'] : '';
        if ($sessionId === '') {
            if (@unlink($path) === false) {
                $errors++;
            } else {
                $deleted++;
            }
            continue;
        }

        if (isSessionExpired($session)) {
            try {
                deleteHostSession($sessionId);
                $deleted++;
            } catch (Throwable $exception) {
                $errors++;
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
    $result = cleanupExpiredSessions();
    echo json_encode([
        'message' => 'Nettoyage des sessions terminé.',
        'result' => $result,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
