<?php

declare(strict_types=1);

/**
 * Utilitaires de dates pour les Syncers.
 *
 * Toutes les dates sont produites au format ISO 8601 UTC
 * pour rester cohérent côté API et stockage JSON.
 */

/**
 * Retourne la date/heure courante en ISO 8601 UTC.
 */
function nowIso8601(): string
{
    return gmdate('c');
}

/**
 * Retourne une date d'expiration en ajoutant N heures.
 *
 * @param int $hours Nombre d'heures à ajouter à maintenant.
 */
function expiresInHoursIso8601(int $hours): string
{
    return gmdate('c', time() + ($hours * 3600));
}

/**
 * Retourne une date d'expiration en ajoutant N secondes.
 *
 * @param int $seconds Nombre de secondes à ajouter à maintenant.
 */
function expiresInSecondsIso8601(int $seconds): string
{
    return gmdate('c', time() + $seconds);
}

