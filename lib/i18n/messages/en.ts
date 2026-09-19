export const englishMessages = {
  about: {
    eyebrow: "About Okapi Learn",
    heading: "Independent by design",
    introduction:
      "Okapi Learn is an unofficial client for authorized users. It is not a Kids&Us product and does not use official branding, characters, artwork, or application assets.",
    limitationsHeading: "Known limitations",
    limitationsText:
      "Production audio, video, and game retrieval are independently disabled until their release checks are approved. Video-linked activities support only complete LISTEN, EXPLORE, and WILDCARD packages using their original pictures and audio. Element names are optional, so complete screen-reader descriptions may be unavailable. Eight other game types, maps, sections, books, downloads, offline use, durable progress, push, and learner photos are not included.",
    privacyHeading: "Privacy first",
    privacyText:
      "There is no analytics or advertising. Credentials are exchanged once by the server and never retained. Game packages are delivered through a same-origin alias route, validated in browser memory, and discarded without storing package content or reporting completion to MyLocker. Authenticated sessions remain server-side for no more than eight hours, using process memory or encrypted shared storage according to the deployment.",
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
    audioFailure: "Audio could not continue. Resume audio or exit this play.",
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
      "This activity is temporarily unavailable. Try again in a moment or return to the video.",
    resumeAudio: "Resume audio",
    unavailable: "This activity is not available for this session.",
    unsupported: "This activity is not compatible with this version.",
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
