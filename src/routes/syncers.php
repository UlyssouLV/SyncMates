<?php

declare(strict_types=1);

/**
 * Routes HTTP liées aux Syncers.
 *
 * Ce fichier gère l'adaptation HTTP:
 * - validation des prérequis de la requête,
 * - parsing du JSON entrant,
 * - mapping vers le service métier,
 * - traduction des exceptions en réponses HTTP.
 */
require_once __DIR__ . '/../services/syncersService.php';

/**
 * Traite POST /api/syncers.
 *
 * Lit le payload JSON, valide les champs nécessaires, crée le Syncer
 * via le service métier puis renvoie la réponse API.
 */
function handleCreateSyncer(): void
{
    // Vérifie que le client envoie bien du JSON.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') === false) {
        jsonResponse(400, [
            'error' => 'Content-Type doit être application/json.',
        ]);
        return;
    }

    // Lit le corps brut de la requête HTTP.
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || $rawBody === '') {
        jsonResponse(400, [
            'error' => 'Corps de requête JSON manquant.',
        ]);
        return;
    }

    // Parse le JSON en tableau associatif PHP.
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        jsonResponse(400, [
            'error' => 'JSON invalide.',
        ]);
        return;
    }

    $name = isset($payload['name']) ? (string) $payload['name'] : '';
    $password = isset($payload['password']) ? (string) $payload['password'] : '';

    try {
        // Délègue la création et la persistance au service métier.
        $createdSyncer = createSyncer($name, $password);
        jsonResponse(201, [
            'message' => 'Syncer créé.',
            'syncer' => $createdSyncer,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(409, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la création du Syncer.',
        ]);
    }
}

/**
 * Envoie une réponse JSON normalisée.
 *
 * @param int   $statusCode Code HTTP à retourner.
 * @param array $body       Payload JSON sérialisable.
 */
function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
}

