/**
 * The Jordanian dinar divides into 1000 fils, not 100 like a cent currency, so
 * amounts are conventionally written to three decimals: 1.250 JD, not 1.25.
 *
 * Because Sanity stores `amount` in major units (an editor types 12.5, meaning
 * twelve and a half dinars), changing `minorPerMajor` needs no data migration —
 * only the app's internal integer representation and the display change.
 *
 * To move to a cent currency, set minorPerMajor to 100 and decimals to 2, and
 * loosen the `amount` validator on the Sanity schema to two decimal places.
 */
export const CURRENCY = {
  /** ISO 4217. This is what the API reports, locale-neutral. */
  code: 'JOD',
  /** Integer minor units in one major unit. 1000 fils to the dinar. */
  minorPerMajor: 1000,
  /** Decimal places to show when there is a fractional part. */
  decimals: 3,
} as const;
