<?php

declare(strict_types=1);

/**
 * Utilitaires de génération d'identifiants/tokens.
 *
 * Les valeurs sont générées via random_bytes pour obtenir
 * des identifiants non prédictibles adaptés à une API publique.
 */

/**
 * Génère un identifiant unique de Syncer.
 */
function generateSyncerId(): string
{
    return 'sync_' . bin2hex(random_bytes(8));
}

/**
 * Génère un token de partage pour l'accès participant.
 */
function generateShareToken(): string
{
    return bin2hex(random_bytes(24));
}

