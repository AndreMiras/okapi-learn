export const englishMessages = {
  about: {
    eyebrow: "About Merriloop",
    heading: "Independent by design",
    introduction:
      "Merriloop is an unofficial client for authorized users. It is not a Kids&Us product and does not use official branding, characters, artwork, or application assets.",
    limitationsHeading: "Known limitations",
    limitationsText:
      "The first release shows catalog metadata. Synthetic playback can be used by maintainers to verify browser mechanics, but production audio and video remain disabled until browser behavior, entitlement, URL lifetime, and licensing are approved. Games, downloads, offline use, progress reporting, push, and learner photos are not included.",
    privacyHeading: "Privacy first",
    privacyText:
      "There is no analytics or advertising. Credentials are exchanged once by the server and never retained. Authenticated sessions are temporary and process restarts sign everyone out.",
    refreshHeading: "Refresh behavior",
    refreshText:
      "Catalog data remains fixed for an authenticated session. Sign in again to refresh it; Merriloop does not store or silently replay a password.",
    title: "About",
  },
  home: {
    aboutLink: "How Merriloop handles privacy",
    eyebrow: "Your learning field notebook",
    heading: "A quiet place for stories, sounds, and discovery.",
    introduction:
      "Merriloop is being built for authorized families to browse their learner catalog on any screen, with credentials and course data kept private.",
    signInPending: "Sign in coming next",
    signInPendingLabel: "Sign in, available in the next phase",
  },
  shell: {
    about: "About",
    homeLabel: "Merriloop home",
    nonAffiliation:
      "Merriloop is an independent, unofficial client. It is not affiliated with, endorsed by, or operated by Kids&Us.",
    primaryNavigation: "Primary navigation",
    skipLink: "Skip to main content",
  },
} as const;
