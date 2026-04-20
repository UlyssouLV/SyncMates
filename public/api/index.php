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

// Fallback pour toute route non implémentée.
http_response_code(404);
echo json_encode([
    'error' => 'Route introuvable.',
], JSON_UNESCAPED_UNICODE);

