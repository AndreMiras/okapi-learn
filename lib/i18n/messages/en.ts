export const englishMessages = {
  about: {
    eyebrow: "About Okapi Learn",
    heading: "Independent by design",
    introduction:
      "Okapi Learn is an unofficial client for authorized users. It is not a Kids&Us product and does not use official branding, characters, artwork, or application assets.",
    limitationsHeading: "Known limitations",
    limitationsText:
      "Production audio, video, and game retrieval are disabled until their release checks are approved. Video-linked games and standalone course-map games support only complete LISTEN, EXPLORE, WILDCARD, and bounded PAINT packages using their original pictures and audio. Seven other game types, unobserved PAINT variants, section-list navigation, books, downloads, offline use, durable progress, push, and learner photos are not included. Neutral PAINT controls do not remove the exercise's visual colour dependence or provide complete nonvisual access.",
    privacyHeading: "Privacy first",
    privacyText:
      "There is no analytics or advertising. Credentials are exchanged once by the server and never retained. Map artwork and game packages use authenticated same-origin alias routes; packages are validated in browser memory and discarded without storing content or reporting completion to MyLocker. Standalone map unlocks last only within the current learner view and reset on reload or learner change. Authenticated sessions remain server-side for no more than eight hours, using process memory or encrypted shared storage according to the deployment.",
    refreshHeading: "Refresh behavior",
    refreshText:
      "Catalog data remains fixed for an authenticated session. Sign in again to refresh it; Okapi Learn does not store or silently replay a password.",
    title: "About",
  },
  home: {
    aboutLink: "How Okapi Learn handles privacy",
    eyebrow: "Your learning field notebook",
    heading: "A quiet place for stories, sounds, and discovery.",
    introduction:
      "Okapi Learn is being built for authorized families to browse their learner catalog on any screen, with credentials and course data kept private.",
    signInPending: "Sign in coming next",
    signInPendingLabel: "Sign in, available in the next phase",
  },
  games: {
    paint: {
      area: "area",
      chooseColour: "Choose a colour",
      chooseTarget: "Choose where it goes",
      colour: "Colour",
      complete: "All targets complete",
      correctColour: "Colour selected. Choose where it goes.",
      heading: "Paint the picture",
      incorrect: "That was not the requested choice. Try again.",
      next: "Target complete. Listen for the next prompt.",
      replay: "Replay prompt",
      target: "Target",
      visualNotice:
        "The colour exercise depends on seeing the picture; neutral control names do not describe its colours or provide complete nonvisual access.",
    },
    audioFailure: "Audio could not continue. Resume audio or exit this play.",
    backToMap: "Back to game map",
    backToVideo: "Back to video",
    completeHeading: "Play complete",
    completeNotice:
      "This completion applies only to this play and is not sent to MyLocker.",
    disabled:
      "Activity playback is unavailable because games are not enabled on this server.",
    exit: "Exit activity",
    exitConfirmation:
      "Exit this play? Your progress in this activity will be cleared.",
    area: "area",
    hotspot: "Hotspot",
    loading: "Preparing and checking this activity in memory...",
    play: "Play activity",
    picture: "Picture",
    retry: "Try again",
    retryable:
      "This activity is temporarily unavailable. Try again in a moment or return to the catalog.",
    resumeAudio: "Resume audio",
    unavailable: "This activity is not available for this session.",
    unsupported: "This activity is not compatible with this version.",
  },
  gameMap: {
    complete:
      "All games currently shown on this map are complete in the initial catalog or this browser view.",
    disabled:
      "The game map is available in this catalog, but playback and artwork are disabled on this server.",
    eyebrow: "Standalone games",
    imageUnavailable: "Map artwork is unavailable for this section.",
    introduction:
      "Choose an available numbered game. Locked games open as you complete the path.",
    progress: "Game status",
    progressNote:
      "Completions added here last only while this learner view remains open and are not sent to MyLocker.",
    standaloneNotice:
      "Completing this activity unlocks the next map game only in this browser view. It is not sent to MyLocker.",
    title: "Game map",
  },
  shell: {
    about: "About",
    homeLabel: "Okapi Learn home",
    nonAffiliation:
      "Okapi Learn is an independent, unofficial client. It is not affiliated with, endorsed by, or operated by Kids&Us.",
    primaryNavigation: "Primary navigation",
    repositoryLink: "Code and issues on GitHub",
    skipLink: "Skip to main content",
  },
} as const;
