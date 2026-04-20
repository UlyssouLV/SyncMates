<?php

declare(strict_types=1);

/**
 * Couche de stockage JSON des sessions host.
 *
 * Chaque session est stockée dans un fichier dédié afin de garder
 * les données d'auth séparées des données métier des Syncers.
 */
require_once __DIR__ . '/../utils/date.php';
require_once __DIR__ . '/../utils/id.php';

/**
 * Retourne le dossier contenant les sessions host.
 */
function sessionsDataDirectory(): string
{
    return __DIR__ . '/../../data/sessions';
}

/**
 * Crée le dossier de sessions s'il n'existe pas.
 */
function ensureSessionsDataDirectoryExists(): void
{
    $dir = sessionsDataDirectory();
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

/**
 * Construit le chemin du fichier session.
 *
 * @param string $sessionId Identifiant de session.
 */
function sessionFilePath(string $sessionId): string
{
    return sessionsDataDirectory() . '/' . $sessionId . '.json';
}

/**
 * Enregistre une session host.
 *
 * @param array $session Session à enregistrer.
 */
function saveHostSession(array $session): void
{
    ensureSessionsDataDirectoryExists();

    $sessionId = isset($session['sessionId']) ? (string) $session['sessionId'] : '';
    if ($sessionId === '') {
        throw new RuntimeException('Identifiant de session invalide.');
    }

    $json = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible de sérialiser la session.');
    }

    $bytes = file_put_contents(sessionFilePath($sessionId), $json, LOCK_EX);
    if ($bytes === false) {
        throw new RuntimeException('Impossible d\'enregistrer la session.');
    }
}

/**
 * Supprime une session host.
 *
 * @param string $sessionId Identifiant de session.
 */
function deleteHostSession(string $sessionId): void
{
    if ($sessionId === '') {
        return;
    }

    $path = sessionFilePath($sessionId);
    if (file_exists($path)) {
        unlink($path);
    }
}

/**
 * Charge une session host et invalide automatiquement les expirées.
 *
 * @param string $sessionId Identifiant de session.
 *
 * @return array|null Session valide, sinon null.
 */
function getHostSessionById(string $sessionId): ?array
{
    if ($sessionId === '') {
        return null;
    }

    $path = sessionFilePath($sessionId);
    if (!file_exists($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }

    $session = json_decode($raw, true);
    if (!is_array($session)) {
        return null;
    }

    $expiresAt = isset($session['expiresAt']) ? (string) $session['expiresAt'] : '';
    if ($expiresAt === '' || strtotime($expiresAt) === false) {
        deleteHostSession($sessionId);
        return null;
    }

    if (strtotime($expiresAt) < time()) {
        deleteHostSession($sessionId);
        return null;
    }

    return $session;
}

/**
 * Crée une session host pour un Syncer.
 *
 * @param string $syncerId Identifiant du Syncer.
 * @param int    $ttlInSeconds Durée de validité en secondes.
 *
 * @return array Session créée.
 */
function createHostSessionForSyncer(string $syncerId, int $ttlInSeconds): array
{
    $session = [
        'sessionId' => generateHostSessionId(),
        'syncerId' => $syncerId,
        'role' => 'host',
        'createdAt' => nowIso8601(),
        'expiresAt' => expiresInSecondsIso8601($ttlInSeconds),
    ];

    saveHostSession($session);
    return $session;
}
