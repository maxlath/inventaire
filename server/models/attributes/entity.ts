export const versioned = [
  'type',
  'labels',
  'claims',
  'redirect',
  // Legacy: this attribute was only used in prod between 2017-01-24 and 2017-01-25
  // TODO: remove from prod patches and here
  // '_deleted',
] as const
