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
    $payload = parseJsonRequestBody();
    if (!is_array($payload)) {
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
 * Traite POST /api/syncers/login.
 *
 * Vérifie les identifiants host (nom/ID + mot de passe) et renvoie
 * le Syncer correspondant en cas d'authentification valide.
 */
function handleLoginSyncer(): void
{
    $payload = parseJsonRequestBody();
    if (!is_array($payload)) {
        return;
    }

    $identifier = isset($payload['identifier']) ? (string) $payload['identifier'] : '';
    $password = isset($payload['password']) ? (string) $payload['password'] : '';

    try {
        $syncer = loginSyncer($identifier, $password);
        jsonResponse(200, [
            'message' => 'Connexion réussie.',
            'syncer' => $syncer,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(401, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la connexion au Syncer.',
        ]);
    }
}

/**
 * Traite POST /api/syncers/{id}/participants.
 *
 * Ajoute un participant au Syncer ciblé.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 */
function handleAddParticipant(string $syncerId): void
{
    $payload = parseJsonRequestBody();
    if (!is_array($payload)) {
        return;
    }

    $participantName = isset($payload['participantName']) ? (string) $payload['participantName'] : '';

    try {
        $syncer = addParticipantToSyncer($syncerId, $participantName);
        jsonResponse(200, [
            'message' => 'Participant ajouté.',
            'syncer' => $syncer,
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
            'error' => 'Erreur serveur lors de l\'ajout du participant.',
        ]);
    }
}

/**
 * Traite DELETE /api/syncers/{id}/participants/{participantId}.
 *
 * Supprime un participant du Syncer ciblé.
 *
 * @param string $syncerId      Identifiant technique du Syncer.
 * @param string $participantId Identifiant du participant à supprimer.
 */
function handleDeleteParticipant(string $syncerId, string $participantId): void
{
    try {
        $syncer = deleteParticipantFromSyncer($syncerId, $participantId);
        jsonResponse(200, [
            'message' => 'Participant supprimé.',
            'syncer' => $syncer,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(404, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la suppression du participant.',
        ]);
    }
}

/**
 * Traite PATCH /api/syncers/{id}/event-period.
 *
 * Configure la plage de dates de l'évènement pour le Syncer.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 */
function handleConfigureEventPeriod(string $syncerId): void
{
    $payload = parseJsonRequestBody();
    if (!is_array($payload)) {
        return;
    }

    $eventStartDate = isset($payload['eventStartDate']) ? (string) $payload['eventStartDate'] : '';
    $eventEndDate = isset($payload['eventEndDate']) ? (string) $payload['eventEndDate'] : '';

    try {
        $syncer = configureSyncerEventPeriod($syncerId, $eventStartDate, $eventEndDate);
        jsonResponse(200, [
            'message' => 'Période de l\'évènement configurée.',
            'syncer' => $syncer,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(404, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la configuration de la période.',
        ]);
    }
}

/**
 * Traite GET /api/syncers/{id}.
 *
 * Renvoie le détail public du Syncer, incluant la liste des participants.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 */
function handleGetSyncerDetails(string $syncerId): void
{
    try {
        $syncer = getSyncerDetails($syncerId);
        jsonResponse(200, [
            'syncer' => $syncer,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(404, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la récupération du Syncer.',
        ]);
    }
}

/**
 * Traite GET /api/syncers/{id}/participants.
 *
 * Renvoie le payload public pour la page participant:
 * nom du Syncer, période et profils participants disponibles.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 */
function handleGetSyncerParticipants(string $syncerId): void
{
    try {
        $payload = getSyncerParticipantsPayload($syncerId);
        jsonResponse(200, [
            'syncer' => $payload,
        ]);
    } catch (InvalidArgumentException $exception) {
        jsonResponse(400, [
            'error' => $exception->getMessage(),
        ]);
    } catch (DomainException $exception) {
        jsonResponse(404, [
            'error' => $exception->getMessage(),
        ]);
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'error' => 'Erreur serveur lors de la récupération des participants.',
        ]);
    }
}

/**
 * Valide et parse un body JSON HTTP.
 *
 * @return array|null Tableau associatif du body JSON, sinon null si erreur.
 */
function parseJsonRequestBody(): ?array
{
    // Vérifie que le client envoie bien du JSON.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') === false) {
        jsonResponse(400, [
            'error' => 'Content-Type doit être application/json.',
        ]);
        return null;
    }

    // Lit le corps brut de la requête HTTP.
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || $rawBody === '') {
        jsonResponse(400, [
            'error' => 'Corps de requête JSON manquant.',
        ]);
        return null;
    }

    // Parse le JSON en tableau associatif PHP.
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        jsonResponse(400, [
            'error' => 'JSON invalide.',
        ]);
        return null;
    }

    return $payload;
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

