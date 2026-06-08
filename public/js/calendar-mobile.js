/**
 * Helpers FullCalendar pour les viewports mobiles.
 *
 * Doc FullCalendar v6 :
 * - hauteur par défaut via aspectRatio si height non défini ;
 * - height: "auto" est déconseillé en dayGridMonth (grille instable) ;
 * - expandRows ne concerne que timeGrid / timeline, pas dayGridMonth.
 */
const SYNCMATES_CALENDAR_MOBILE_QUERY = "(max-width: 780px)";
const SYNCMATES_MOBILE_ASPECT_RATIO = 0.95;

/**
 * Indique si la largeur courante correspond au mode mobile calendrier.
 *
 * @returns {boolean} true sur mobile.
 */
function isSyncMatesCalendarMobileViewport() {
  return window.matchMedia(SYNCMATES_CALENDAR_MOBILE_QUERY).matches;
}

/**
 * Retourne les options FullCalendar adaptées à la largeur d'écran.
 *
 * @param {number} desktopHeight Hauteur fixe sur desktop.
 * @returns {Object} Options à fusionner dans la config du calendrier.
 */
function getSyncMatesCalendarOptions(desktopHeight) {
  if (isSyncMatesCalendarMobileViewport()) {
    return {
      height: null,
      contentHeight: null,
      aspectRatio: SYNCMATES_MOBILE_ASPECT_RATIO,
      expandRows: false,
      dayHeaderFormat: { weekday: "narrow" },
    };
  }

  return {
    height: desktopHeight,
    contentHeight: null,
    aspectRatio: null,
    expandRows: true,
    dayHeaderFormat: { weekday: "short" },
  };
}

/**
 * Applique les options responsives et écoute les changements de breakpoint.
 *
 * @param {Object|null} calendar Instance FullCalendar.
 * @param {number} desktopHeight Hauteur desktop de référence.
 */
function bindSyncMatesResponsiveCalendar(calendar, desktopHeight) {
  if (!calendar) {
    return;
  }

  const mediaQuery = window.matchMedia(SYNCMATES_CALENDAR_MOBILE_QUERY);
  const syncOptions = () => {
    const options = getSyncMatesCalendarOptions(desktopHeight);
    calendar.setOption("height", options.height);
    calendar.setOption("contentHeight", options.contentHeight);
    calendar.setOption("aspectRatio", options.aspectRatio);
    calendar.setOption("expandRows", options.expandRows);
    calendar.setOption("dayHeaderFormat", options.dayHeaderFormat);

    requestAnimationFrame(() => {
      if (typeof calendar.updateSize === "function") {
        calendar.updateSize();
      }
    });
  };

  syncOptions();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", syncOptions);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(syncOptions);
  }
}
