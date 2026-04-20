<?php

declare(strict_types=1);

/**
 * Point d'entrée HTTP de l'API.
 *
 * Ce fichier:
 * - charge les routes API,
 * - normalise la requête entrante,
 * - dispatch les routes supportées,
 * - renvoie 404 JSON pour toute route inconnue.
 */
require_once __DIR__ . '/../../src/routes/syncers.php';

header('Content-Type: application/json; charset=utf-8');

// Récupère les informations principales de la requête courante.
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH) ?? '/';
$normalizedPath = rtrim($path, '/');

$isCreateSyncerRoute = $normalizedPath === '/api/syncers';
$isLoginSyncerRoute = $normalizedPath === '/api/syncers/login';
$getSyncerMatches = [];
$isGetSyncerRoute = preg_match('#^/api/syncers/([^/]+)$#', $normalizedPath, $getSyncerMatches) === 1;
$addParticipantMatches = [];
$isAddParticipantRoute = preg_match('#^/api/syncers/([^/]+)/participants$#', $normalizedPath, $addParticipantMatches) === 1;
$deleteParticipantMatches = [];
$isDeleteParticipantRoute = preg_match('#^/api/syncers/([^/]+)/participants/([^/]+)$#', $normalizedPath, $deleteParticipantMatches) === 1;
$eventPeriodMatches = [];
$isEventPeriodRoute = preg_match('#^/api/syncers/([^/]+)/event-period$#', $normalizedPath, $eventPeriodMatches) === 1;
$participantUnavailabilitiesMatches = [];
$isParticipantUnavailabilitiesRoute = preg_match('#^/api/syncers/([^/]+)/participants/([^/]+)/unavailabilities$#', $normalizedPath, $participantUnavailabilitiesMatches) === 1;

// Route: création d'un Syncer.
if ($isCreateSyncerRoute && $method === 'POST') {
    handleCreateSyncer();
    exit;
}

// Route: connexion à un Syncer.
if ($isLoginSyncerRoute && $method === 'POST') {
    handleLoginSyncer();
    exit;
}

// Route: détail d'un Syncer.
if ($isGetSyncerRoute && $method === 'GET') {
    $syncerId = isset($getSyncerMatches[1]) ? (string) $getSyncerMatches[1] : '';
    handleGetSyncerDetails($syncerId);
    exit;
}

// Route: ajout d'un participant à un Syncer.
if ($isAddParticipantRoute && $method === 'POST') {
    $syncerId = isset($addParticipantMatches[1]) ? (string) $addParticipantMatches[1] : '';
    handleAddParticipant($syncerId);
    exit;
}

// Route: liste des profils participants d'un Syncer.
if ($isAddParticipantRoute && $method === 'GET') {
    $syncerId = isset($addParticipantMatches[1]) ? (string) $addParticipantMatches[1] : '';
    handleGetSyncerParticipants($syncerId);
    exit;
}

// Route: suppression d'un participant d'un Syncer.
if ($isDeleteParticipantRoute && $method === 'DELETE') {
    $syncerId = isset($deleteParticipantMatches[1]) ? (string) $deleteParticipantMatches[1] : '';
    $participantId = isset($deleteParticipantMatches[2]) ? (string) $deleteParticipantMatches[2] : '';
    handleDeleteParticipant($syncerId, $participantId);
    exit;
}

// Route: configuration de la plage de dates de l'évènement.
if ($isEventPeriodRoute && $method === 'PATCH') {
    $syncerId = isset($eventPeriodMatches[1]) ? (string) $eventPeriodMatches[1] : '';
    handleConfigureEventPeriod($syncerId);
    exit;
}

// Route: chargement des indisponibilités d'un participant.
if ($isParticipantUnavailabilitiesRoute && $method === 'GET') {
    $syncerId = isset($participantUnavailabilitiesMatches[1]) ? (string) $participantUnavailabilitiesMatches[1] : '';
    $participantId = isset($participantUnavailabilitiesMatches[2]) ? (string) $participantUnavailabilitiesMatches[2] : '';
    handleGetParticipantUnavailabilities($syncerId, $participantId);
    exit;
}

// Route: mise à jour des indisponibilités d'un participant.
if ($isParticipantUnavailabilitiesRoute && $method === 'PATCH') {
    $syncerId = isset($participantUnavailabilitiesMatches[1]) ? (string) $participantUnavailabilitiesMatches[1] : '';
    $participantId = isset($participantUnavailabilitiesMatches[2]) ? (string) $participantUnavailabilitiesMatches[2] : '';
    handleUpdateParticipantUnavailabilities($syncerId, $participantId);
    exit;
}

// Fallback pour toute route non implémentée.
http_response_code(404);
echo json_encode([
    'error' => 'Route introuvable.',
], JSON_UNESCAPED_UNICODE);

