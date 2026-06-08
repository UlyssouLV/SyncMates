<?php

declare(strict_types=1);

/**
 * Service métier des Syncers.
 *
 * Ce fichier contient la logique métier pure:
 * - validation fonctionnelle des entrées,
 * - génération des identifiants et métadonnées,
 * - hash du mot de passe,
 * - persistance du Syncer.
 */
require_once __DIR__ . '/../storage/jsonStore.php';
require_once __DIR__ . '/../utils/date.php';
require_once __DIR__ . '/../utils/id.php';

/**
 * Crée un Syncer et l'enregistre dans le stockage JSON.
 *
 * @param string $name     Nom utilisateur du Syncer.
 * @param string $password Mot de passe brut saisi par le host.
 *
 * @return array Syncer créé, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les entrées sont invalides.
 * @throws RuntimeException         Si une erreur de génération/stockage survient.
 */
function createSyncer(string $name, string $password): array
{
    // Nettoie le nom pour éviter les espaces seuls.
    $trimmedName = trim($name);
    if ($trimmedName === '') {
        throw new InvalidArgumentException('Le nom du Syncer est requis.');
    }

    if ($password === '') {
        throw new InvalidArgumentException('Le mot de passe est requis.');
    }

    // Empêche la création si l'association name + password existe déjà.
    $existingSyncer = findSyncerByNameAndPassword($trimmedName, $password);
    if (is_array($existingSyncer)) {
        throw new DomainException('Un Syncer avec ce nom et ce mot de passe existe déjà.');
    }

    // Génère un ID et évite les collisions disque.
    $syncerId = generateSyncerId();
    $attempts = 0;
    while (syncerExists($syncerId) && $attempts < 5) {
        $syncerId = generateSyncerId();
        $attempts++;
    }

    if (syncerExists($syncerId)) {
        throw new RuntimeException('Collision d\'identifiant Syncer.');
    }

    // Prépare la structure persistée côté serveur.
    $syncer = [
        'id' => $syncerId,
        'name' => $trimmedName,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'host' => [
            'name' => 'Host',
        ],
        'participants' => [],
        'eventStartDate' => null,
        'eventEndDate' => null,
        'exceptionDates' => [],
        'createdAt' => nowIso8601(),
        'expiresAt' => expiresInHoursIso8601(48),
        'shareToken' => generateShareToken(),
    ];

    // Persiste le Syncer dans data/syncers/{id}.json.
    saveSyncer($syncer);

    // Ne jamais exposer le hash dans la réponse API.
    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Authentifie un host sur un Syncer existant.
 *
 * @param string $identifier Identifiant saisi (ID technique ou nom du Syncer).
 * @param string $password   Mot de passe brut saisi par le host.
 *
 * @return array Syncer authentifié, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les entrées sont invalides.
 * @throws DomainException          Si l'authentification échoue.
 */
function loginSyncer(string $identifier, string $password): array
{
    $trimmedIdentifier = trim($identifier);
    if ($trimmedIdentifier === '') {
        throw new InvalidArgumentException('Le nom ou identifiant du Syncer est requis.');
    }

    if ($password === '') {
        throw new InvalidArgumentException('Le mot de passe est requis.');
    }

    $syncer = findSyncerForLogin($trimmedIdentifier, $password);
    if (!is_array($syncer)) {
        throw new DomainException('Identifiants de connexion invalides.');
    }

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Ajoute un participant à un Syncer existant.
 *
 * @param string $syncerId        Identifiant technique du Syncer.
 * @param string $participantName Nom du participant à ajouter.
 *
 * @return array Syncer mis à jour, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les paramètres sont invalides.
 * @throws DomainException          Si ressource invalide.
 */
function addParticipantToSyncer(string $syncerId, string $participantName): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedParticipantName = trim($participantName);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    if ($trimmedParticipantName === '') {
        throw new InvalidArgumentException('Le nom du participant est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    foreach ($participants as $participant) {
        $existingName = isset($participant['name']) ? (string) $participant['name'] : '';
        if ($existingName !== '' && strtolower($existingName) === strtolower($trimmedParticipantName)) {
            throw new DomainException('Un participant avec ce nom existe déjà.');
        }
    }

    $participants[] = [
        'id' => generateParticipantId(),
        'name' => $trimmedParticipantName,
        'unavailableDates' => [],
        'availableDates' => [],
        'availabilityModel' => 'three-state',
    ];

    $syncer['participants'] = $participants;
    saveSyncer($syncer);

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Retourne le détail d'un Syncer par son identifiant.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 *
 * @return array Syncer trouvé, sans passwordHash.
 *
 * @throws InvalidArgumentException Si l'identifiant est vide.
 * @throws DomainException          Si le Syncer n'existe pas.
 */
function getSyncerDetails(string $syncerId): array
{
    $trimmedSyncerId = trim($syncerId);
    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Retourne les informations nécessaires à la page participant.
 *
 * Ce payload permet d'afficher:
 * - le nom du Syncer,
 * - la période configurée,
 * - la liste des profils participants sélectionnables.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 *
 * @return array Données publiques du Syncer pour la vue participant.
 *
 * @throws InvalidArgumentException Si l'identifiant est vide.
 * @throws DomainException          Si le Syncer n'existe pas.
 */
function getSyncerParticipantsPayload(string $syncerId): array
{
    $syncer = getSyncerDetails($syncerId);

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    $participantProfiles = [];
    foreach ($participants as $participant) {
        $participantProfiles[] = [
            'id' => isset($participant['id']) ? (string) $participant['id'] : '',
            'name' => isset($participant['name']) ? (string) $participant['name'] : '',
        ];
    }

    return [
        'id' => isset($syncer['id']) ? (string) $syncer['id'] : '',
        'name' => isset($syncer['name']) ? (string) $syncer['name'] : '',
        'eventStartDate' => isset($syncer['eventStartDate']) ? $syncer['eventStartDate'] : null,
        'eventEndDate' => isset($syncer['eventEndDate']) ? $syncer['eventEndDate'] : null,
        'exceptionDates' => getSyncerExceptionDates($syncer),
        'participants' => $participantProfiles,
    ];
}

/**
 * Retourne les indisponibilités d'un participant d'un Syncer.
 *
 * @param string $syncerId      Identifiant technique du Syncer.
 * @param string $participantId Identifiant du participant.
 *
 * @return array Données participant (id, name, unavailableDates, availableDates, availabilityModel).
 *
 * @throws InvalidArgumentException Si les identifiants sont invalides.
 * @throws DomainException          Si le Syncer/participant est introuvable.
 */
function getParticipantUnavailabilities(string $syncerId, string $participantId): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedParticipantId = trim($participantId);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }
    if ($trimmedParticipantId === '') {
        throw new InvalidArgumentException('L\'identifiant du participant est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    foreach ($participants as $participant) {
        $currentParticipantId = isset($participant['id']) ? (string) $participant['id'] : '';
        if ($currentParticipantId !== $trimmedParticipantId) {
            continue;
        }

        return buildParticipantAvailabilityPayload($participant);
    }

    throw new DomainException('Participant introuvable.');
}

/**
 * Enregistre les disponibilités d'un participant.
 *
 * @param string $syncerId         Identifiant technique du Syncer.
 * @param string $participantId    Identifiant du participant.
 * @param array  $unavailableDates Liste des dates indisponibles (YYYY-MM-DD).
 * @param array  $availableDates   Liste des dates disponibles (YYYY-MM-DD).
 * @param string $availabilityModel Modèle explicite (three-state|unavailabilities-only).
 *
 * @return array Données participant mises à jour.
 *
 * @throws InvalidArgumentException Si les paramètres sont invalides.
 * @throws DomainException          Si le Syncer/participant est introuvable.
 */
function updateParticipantUnavailabilities(
    string $syncerId,
    string $participantId,
    array $unavailableDates,
    array $availableDates = [],
    string $availabilityModel = ''
): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedParticipantId = trim($participantId);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }
    if ($trimmedParticipantId === '') {
        throw new InvalidArgumentException('L\'identifiant du participant est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $eventStartDate = isset($syncer['eventStartDate']) ? (string) $syncer['eventStartDate'] : '';
    $eventEndDate = isset($syncer['eventEndDate']) ? (string) $syncer['eventEndDate'] : '';
    if ($eventStartDate === '' || $eventEndDate === '') {
        throw new DomainException('La période de l\'évènement n\'est pas configurée.');
    }

    $exceptionDates = getSyncerExceptionDates($syncer);

    $normalizedUnavailableDates = normalizeParticipantDateList(
        $unavailableDates,
        $eventStartDate,
        $eventEndDate
    );
    $normalizedAvailableDates = normalizeParticipantDateList(
        $availableDates,
        $eventStartDate,
        $eventEndDate
    );

    $normalizedUnavailableDates = filterDatesExcludingExceptions($normalizedUnavailableDates, $exceptionDates);
    $normalizedAvailableDates = filterDatesExcludingExceptions($normalizedAvailableDates, $exceptionDates);

    $overlapDates = array_intersect($normalizedUnavailableDates, $normalizedAvailableDates);
    if (count($overlapDates) > 0) {
        throw new InvalidArgumentException('Une date ne peut pas être à la fois disponible et indisponible.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    $updatedParticipant = null;
    foreach ($participants as &$participant) {
        $currentParticipantId = isset($participant['id']) ? (string) $participant['id'] : '';
        if ($currentParticipantId !== $trimmedParticipantId) {
            continue;
        }

        $resolvedAvailabilityModel = resolveParticipantAvailabilityModelForSave(
            $normalizedUnavailableDates,
            $normalizedAvailableDates,
            $availabilityModel
        );

        $participant['unavailableDates'] = $normalizedUnavailableDates;
        $participant['availableDates'] = $resolvedAvailabilityModel === 'unavailabilities-only'
            ? []
            : $normalizedAvailableDates;
        $participant['availabilityModel'] = $resolvedAvailabilityModel;
        $updatedParticipant = buildParticipantAvailabilityPayload($participant);
        break;
    }
    unset($participant);

    if (!is_array($updatedParticipant)) {
        throw new DomainException('Participant introuvable.');
    }

    $syncer['participants'] = $participants;
    saveSyncer($syncer);

    return $updatedParticipant;
}

/**
 * Supprime un participant d'un Syncer existant.
 *
 * @param string $syncerId      Identifiant technique du Syncer.
 * @param string $participantId Identifiant du participant à supprimer.
 *
 * @return array Syncer mis à jour, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les identifiants sont invalides.
 * @throws DomainException          Si le Syncer ou le participant n'existe pas.
 */
function deleteParticipantFromSyncer(string $syncerId, string $participantId): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedParticipantId = trim($participantId);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    if ($trimmedParticipantId === '') {
        throw new InvalidArgumentException('L\'identifiant du participant est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    $filteredParticipants = [];
    $participantFound = false;
    foreach ($participants as $participant) {
        $currentParticipantId = isset($participant['id']) ? (string) $participant['id'] : '';
        if ($currentParticipantId === $trimmedParticipantId) {
            $participantFound = true;
            continue;
        }
        $filteredParticipants[] = $participant;
    }

    if (!$participantFound) {
        throw new DomainException('Participant introuvable.');
    }

    $syncer['participants'] = $filteredParticipants;
    saveSyncer($syncer);

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Configure la plage de dates d'un Syncer (fenêtre de l'évènement).
 *
 * @param string $syncerId       Identifiant technique du Syncer.
 * @param string $eventStartDate Date de début au format YYYY-MM-DD.
 * @param string $eventEndDate   Date de fin au format YYYY-MM-DD.
 *
 * @return array Syncer mis à jour, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les dates sont invalides.
 * @throws DomainException          Si le Syncer est introuvable.
 */
function configureSyncerEventPeriod(string $syncerId, string $eventStartDate, string $eventEndDate): array
{
    $trimmedSyncerId = trim($syncerId);
    $trimmedStartDate = trim($eventStartDate);
    $trimmedEndDate = trim($eventEndDate);

    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    if (!isValidIsoDate($trimmedStartDate) || !isValidIsoDate($trimmedEndDate)) {
        throw new InvalidArgumentException('Les dates doivent être au format YYYY-MM-DD.');
    }

    if ($trimmedStartDate > $trimmedEndDate) {
        throw new InvalidArgumentException('La date de début doit être antérieure ou égale à la date de fin.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $existingExceptionDates = getSyncerExceptionDates($syncer);
    $filteredExceptionDates = [];
    foreach ($existingExceptionDates as $exceptionDate) {
        if ($exceptionDate >= $trimmedStartDate && $exceptionDate <= $trimmedEndDate) {
            $filteredExceptionDates[] = $exceptionDate;
        }
    }

    $syncer['eventStartDate'] = $trimmedStartDate;
    $syncer['eventEndDate'] = $trimmedEndDate;
    $syncer['exceptionDates'] = array_values($filteredExceptionDates);
    saveSyncer($syncer);

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Enregistre les jours d'exception d'un Syncer (jours non organisables).
 *
 * @param string $syncerId       Identifiant technique du Syncer.
 * @param array  $exceptionDates Liste des dates d'exception (YYYY-MM-DD).
 *
 * @return array Syncer mis à jour, sans passwordHash.
 *
 * @throws InvalidArgumentException Si les paramètres sont invalides.
 * @throws DomainException          Si le Syncer est introuvable ou la période absente.
 */
function updateSyncerExceptionDates(string $syncerId, array $exceptionDates): array
{
    $trimmedSyncerId = trim($syncerId);
    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $eventStartDate = isset($syncer['eventStartDate']) ? (string) $syncer['eventStartDate'] : '';
    $eventEndDate = isset($syncer['eventEndDate']) ? (string) $syncer['eventEndDate'] : '';
    if ($eventStartDate === '' || $eventEndDate === '') {
        throw new DomainException('La période de l\'évènement n\'est pas configurée.');
    }

    $normalizedExceptionDates = normalizeParticipantDateList(
        $exceptionDates,
        $eventStartDate,
        $eventEndDate
    );

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];

    foreach ($participants as &$participant) {
        if (isset($participant['unavailableDates']) && is_array($participant['unavailableDates'])) {
            $participant['unavailableDates'] = filterDatesExcludingExceptions(
                array_values($participant['unavailableDates']),
                $normalizedExceptionDates
            );
        }
        if (isset($participant['availableDates']) && is_array($participant['availableDates'])) {
            $participant['availableDates'] = filterDatesExcludingExceptions(
                array_values($participant['availableDates']),
                $normalizedExceptionDates
            );
        }
    }
    unset($participant);

    $syncer['participants'] = $participants;
    $syncer['exceptionDates'] = $normalizedExceptionDates;
    saveSyncer($syncer);

    unset($syncer['passwordHash']);
    return $syncer;
}

/**
 * Vérifie qu'une date respecte strictement le format YYYY-MM-DD.
 *
 * @param string $date Date à valider.
 */
function isValidIsoDate(string $date): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return false;
    }

    [$year, $month, $day] = array_map('intval', explode('-', $date));
    return checkdate($month, $day, $year);
}

/**
 * Calcule les résultats de disponibilité d'un Syncer.
 *
 * Le calcul est basé sur:
 * - la plage eventStartDate/eventEndDate,
 * - les unavailableDates et availableDates de chaque participant.
 *
 * @param string $syncerId Identifiant technique du Syncer.
 *
 * @return array Résultats agrégés (bestDates, dailyAvailability, participants).
 *
 * @throws InvalidArgumentException Si l'identifiant est invalide.
 * @throws DomainException          Si le Syncer/plage est introuvable ou invalide.
 */
function getSyncerResults(string $syncerId): array
{
    $trimmedSyncerId = trim($syncerId);
    if ($trimmedSyncerId === '') {
        throw new InvalidArgumentException('L\'identifiant du Syncer est requis.');
    }

    $syncer = getSyncerById($trimmedSyncerId);
    if (!is_array($syncer)) {
        throw new DomainException('Syncer introuvable.');
    }

    $eventStartDate = isset($syncer['eventStartDate']) ? (string) $syncer['eventStartDate'] : '';
    $eventEndDate = isset($syncer['eventEndDate']) ? (string) $syncer['eventEndDate'] : '';
    if (!isValidIsoDate($eventStartDate) || !isValidIsoDate($eventEndDate)) {
        throw new DomainException('La période de l\'évènement n\'est pas configurée correctement.');
    }
    if ($eventStartDate > $eventEndDate) {
        throw new DomainException('La période du Syncer est invalide.');
    }

    $participants = isset($syncer['participants']) && is_array($syncer['participants'])
        ? $syncer['participants']
        : [];
    $totalParticipants = count($participants);

    $participantSummaries = [];
    foreach ($participants as $participant) {
        $participantSummaries[] = buildParticipantAvailabilityPayload($participant);
    }

    $exceptionDates = getSyncerExceptionDates($syncer);

    $dailyAvailability = [];
    $currentDate = $eventStartDate;
    while ($currentDate <= $eventEndDate) {
        if (in_array($currentDate, $exceptionDates, true)) {
            $currentDate = date('Y-m-d', strtotime($currentDate . ' +1 day'));
            continue;
        }

        $availableCount = 0;
        $unavailableCount = 0;
        $unspecifiedCount = 0;
        $availableParticipants = [];
        $unavailableParticipants = [];
        $unspecifiedParticipants = [];

        foreach ($participants as $participant) {
            $name = isset($participant['name']) ? (string) $participant['name'] : 'Participant';
            $dateState = resolveParticipantDateState($participant, $currentDate);

            if ($dateState === 'unavailable') {
                $unavailableCount++;
                $unavailableParticipants[] = $name;
                continue;
            }

            if ($dateState === 'available') {
                $availableCount++;
                $availableParticipants[] = $name;
                continue;
            }

            $unspecifiedCount++;
            $unspecifiedParticipants[] = $name;
        }

        sort($availableParticipants);
        sort($unavailableParticipants);
        sort($unspecifiedParticipants);

        $availabilityRate = $totalParticipants > 0
            ? round(($availableCount / $totalParticipants) * 100, 2)
            : 0.0;

        $dailyAvailability[] = [
            'date' => $currentDate,
            'availableCount' => $availableCount,
            'unavailableCount' => $unavailableCount,
            'unspecifiedCount' => $unspecifiedCount,
            'availabilityRate' => $availabilityRate,
            'availableParticipants' => $availableParticipants,
            'unavailableParticipants' => $unavailableParticipants,
            'unspecifiedParticipants' => $unspecifiedParticipants,
        ];

        $currentDate = date('Y-m-d', strtotime($currentDate . ' +1 day'));
    }

    // Trie les dates selon la dispo la plus élevée puis date croissante.
    $sortedDates = $dailyAvailability;
    usort($sortedDates, static function (array $a, array $b): int {
        if ($a['availableCount'] === $b['availableCount']) {
            return strcmp((string) $a['date'], (string) $b['date']);
        }
        return $b['availableCount'] <=> $a['availableCount'];
    });

    // Le top contient toutes les dates ex aequo sur le meilleur score.
    $bestDates = [];
    if (count($sortedDates) > 0) {
        $bestAvailableCount = (int) $sortedDates[0]['availableCount'];
        foreach ($sortedDates as $dateRow) {
            if ((int) $dateRow['availableCount'] !== $bestAvailableCount) {
                break;
            }
            $bestDates[] = $dateRow;
        }
    }

    return [
        'syncer' => [
            'id' => isset($syncer['id']) ? (string) $syncer['id'] : '',
            'name' => isset($syncer['name']) ? (string) $syncer['name'] : '',
            'eventStartDate' => $eventStartDate,
            'eventEndDate' => $eventEndDate,
            'exceptionDates' => $exceptionDates,
        ],
        'participantsCount' => $totalParticipants,
        'participants' => $participantSummaries,
        'bestDates' => $bestDates,
        'dailyAvailability' => $dailyAvailability,
    ];
}

/**
 * Indique si un participant utilise le modèle à trois états.
 *
 * @param array $participant Données participant.
 */
/**
 * Retourne les jours d'exception d'un Syncer.
 *
 * @param array $syncer Données Syncer.
 *
 * @return array Dates d'exception triées (YYYY-MM-DD).
 */
function getSyncerExceptionDates(array $syncer): array
{
    if (!isset($syncer['exceptionDates']) || !is_array($syncer['exceptionDates'])) {
        return [];
    }

    $dates = array_values($syncer['exceptionDates']);
    sort($dates);

    return $dates;
}

/**
 * Retire les dates d'exception d'une liste de dates participant.
 *
 * @param array $dates           Dates à filtrer.
 * @param array $exceptionDates  Dates d'exception du Syncer.
 *
 * @return array Dates filtrées.
 */
function filterDatesExcludingExceptions(array $dates, array $exceptionDates): array
{
    if (count($exceptionDates) === 0) {
        return array_values($dates);
    }

    $filteredDates = [];
    foreach ($dates as $date) {
        if (!in_array($date, $exceptionDates, true)) {
            $filteredDates[] = $date;
        }
    }

    return array_values($filteredDates);
}

function participantUsesThreeStateAvailability(array $participant): bool
{
    return resolveParticipantAvailabilityModel($participant) === 'three-state';
}

/**
 * Indique si le participant n'a renseigné que des indisponibilités.
 *
 * Dans ce modèle, toutes les autres dates de la plage sont disponibles.
 *
 * @param array $participant Données participant.
 */
function participantUsesUnavailabilitiesOnlyAvailability(array $participant): bool
{
    return resolveParticipantAvailabilityModel($participant) === 'unavailabilities-only';
}

/**
 * Détermine le modèle de disponibilité effectif d'un participant.
 *
 * @param array $participant Données participant.
 *
 * @return string three-state|unavailabilities-only|legacy
 */
function resolveParticipantAvailabilityModel(array $participant): string
{
    $storedModel = isset($participant['availabilityModel'])
        ? trim((string) $participant['availabilityModel'])
        : '';

    if ($storedModel === 'legacy') {
        return 'legacy';
    }

    if ($storedModel === 'unavailabilities-only') {
        return 'unavailabilities-only';
    }

    $unavailableDates = isset($participant['unavailableDates']) && is_array($participant['unavailableDates'])
        ? $participant['unavailableDates']
        : [];
    $availableDates = isset($participant['availableDates']) && is_array($participant['availableDates'])
        ? $participant['availableDates']
        : [];

    if (count($availableDates) === 0 && count($unavailableDates) > 0) {
        return 'unavailabilities-only';
    }

    return 'three-state';
}

/**
 * Détermine le modèle à enregistrer selon les listes envoyées par le client.
 *
 * @param array  $unavailableDates Dates indisponibles normalisées.
 * @param array  $availableDates   Dates disponibles normalisées.
 * @param string $requestedModel   Modèle demandé par le client.
 *
 * @return string three-state|unavailabilities-only
 */
function resolveParticipantAvailabilityModelForSave(
    array $unavailableDates,
    array $availableDates,
    string $requestedModel = ''
): string
{
    $trimmedModel = trim($requestedModel);
    if ($trimmedModel === 'three-state') {
        return 'three-state';
    }

    if ($trimmedModel === 'unavailabilities-only') {
        return 'unavailabilities-only';
    }

    if (count($availableDates) > 0) {
        return 'three-state';
    }

    if (count($unavailableDates) > 0) {
        return 'unavailabilities-only';
    }

    return 'three-state';
}

/**
 * Normalise une liste de dates participant dans la plage de l'évènement.
 *
 * @param array  $dates            Dates brutes.
 * @param string $eventStartDate   Début de plage.
 * @param string $eventEndDate     Fin de plage.
 *
 * @return array Dates uniques triées (YYYY-MM-DD).
 */
function normalizeParticipantDateList(array $dates, string $eventStartDate, string $eventEndDate): array
{
    $normalizedDates = [];
    foreach ($dates as $date) {
        $currentDate = trim((string) $date);
        if (!isValidIsoDate($currentDate)) {
            throw new InvalidArgumentException('Chaque date doit respecter le format YYYY-MM-DD.');
        }
        if ($currentDate < $eventStartDate || $currentDate > $eventEndDate) {
            throw new InvalidArgumentException('Les dates doivent rester dans la plage de l\'évènement.');
        }
        $normalizedDates[$currentDate] = true;
    }

    $result = array_keys($normalizedDates);
    sort($result);

    return $result;
}

/**
 * Construit le payload public des disponibilités d'un participant.
 *
 * @param array $participant Données participant brutes.
 *
 * @return array Données normalisées pour l'API.
 */
function buildParticipantAvailabilityPayload(array $participant): array
{
    return [
        'id' => isset($participant['id']) ? (string) $participant['id'] : '',
        'name' => isset($participant['name']) ? (string) $participant['name'] : '',
        'unavailableDates' => isset($participant['unavailableDates']) && is_array($participant['unavailableDates'])
            ? array_values($participant['unavailableDates'])
            : [],
        'availableDates' => isset($participant['availableDates']) && is_array($participant['availableDates'])
            ? array_values($participant['availableDates'])
            : [],
        'availabilityModel' => resolveParticipantAvailabilityModel($participant),
    ];
}

/**
 * Résout l'état d'un participant pour une date donnée.
 *
 * @param array  $participant Données participant.
 * @param string $currentDate Date testée (YYYY-MM-DD).
 *
 * @return string unavailable|available|unspecified
 */
function resolveParticipantDateState(array $participant, string $currentDate): string
{
    $unavailableDates = isset($participant['unavailableDates']) && is_array($participant['unavailableDates'])
        ? $participant['unavailableDates']
        : [];
    if (in_array($currentDate, $unavailableDates, true)) {
        return 'unavailable';
    }

    $availableDates = isset($participant['availableDates']) && is_array($participant['availableDates'])
        ? $participant['availableDates']
        : [];
    if (participantUsesUnavailabilitiesOnlyAvailability($participant)) {
        return 'available';
    }

    if (in_array($currentDate, $availableDates, true)) {
        return 'available';
    }

    if (participantUsesThreeStateAvailability($participant)) {
        return 'unspecified';
    }

    // Ancien modèle: absence de l'indisponible = disponible.
    return 'available';
}

