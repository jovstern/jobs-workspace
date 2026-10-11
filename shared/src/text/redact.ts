// Removes email addresses, links, phone numbers and street addresses from resume text before it
// is saved or sent anywhere (D-07, D-18). Pure and isomorphic: no DOM, no node: imports, no
// library. The browser and the server run this same function on the same canonical string, so the
// placeholders are identical in the saved text, in the request and in quote checking.
//
// Removal is pattern based and incomplete by design: it recognises common formats only. The
// person's name is never touched. Every pattern is written without nested unbounded quantifiers,
// and every match starts at a token boundary, so matching stays linear on a 60,000-character text.
//
// Order matters: email, then links, then phone numbers, then addresses, so one pattern never eats
// part of another. No placeholder contains a digit, an at-sign or a street word, which is what
// makes a second pass a no-op.

export interface RedactionCounts {
  email: number
  phone: number
  address: number
  link: number
}

export interface RedactionResult {
  text: string
  counts: RedactionCounts
}

const EMAIL_PLACEHOLDER = '[email removed]'
const PHONE_PLACEHOLDER = '[phone removed]'
const ADDRESS_PLACEHOLDER = '[address removed]'
const LINK_PLACEHOLDER = '[link removed]'

// Every placeholder this module can write. Other code that must tell removed text from real text
// (quote checking) reads this list, so a new kind cannot be forgotten there.
export const CONTACT_PLACEHOLDERS: readonly string[] = [
  EMAIL_PLACEHOLDER,
  PHONE_PLACEHOLDER,
  ADDRESS_PLACEHOLDER,
  LINK_PLACEHOLDER,
]

// The placeholder words without their brackets, so "email removed" is caught as well.
const PLACEHOLDER_ANY = new RegExp(
  CONTACT_PLACEHOLDERS.map((placeholder) => `\\[?${placeholder.slice(1, -1)}\\]?`).join('|'),
  'gi',
)

// Replaces every placeholder with a space. What is left is the text that was really in the resume.
export function stripContactPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_ANY, ' ')
}

// A phone number needs at least this many digits; dates, versions and salary ranges have fewer.
const MIN_PLUS_PHONE_DIGITS = 8

type Kind = keyof RedactionCounts

interface Rule {
  kind: Kind
  pattern: RegExp
  placeholder: string
  // Lets a rule reject a candidate the pattern alone cannot tell apart from a resume fact.
  accept?: (match: string) => boolean
}

// Matches an address with a dotted domain. The local part may only start at a token boundary,
// which keeps the scan linear. A mention such as "@angular/core" has no local part and stays.
const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu

// Matches anything with an http or https scheme. Trailing sentence punctuation is left outside.
const LINK_SCHEME = /\bhttps?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]]/giu

// Matches a token starting with "www.". A bare word.word such as Node.js or Socket.IO never
// matches, because it has neither a scheme, a www. prefix nor a known profile host.
const LINK_WWW = /(?<![\p{L}\p{N}@./-])www\.[^\s<>"'`]*[^\s<>"'`.,;:!?)\]]/giu

// Matches a scheme-less address on a known profile host when a path follows it, with at most one
// subdomain label. "linux.com/x" is not x.com, because the host must start at a token boundary.
const LINK_PROFILE_HOST =
  /(?<![\p{L}\p{N}@._-])(?:[a-z0-9-]{1,30}\.)?(?:linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|medium\.com|x\.com|twitter\.com)\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]]/giu

// Digit boundaries for the phone patterns below: a number may not start inside a longer number,
// a word, or a date such as 2018-06-15, and may not run on into more digits.
const NOT_AFTER = String.raw`(?<![\p{L}\p{N}])(?<!\p{N}[-./])`
const NOT_BEFORE = String.raw`(?!\p{N})(?![-./]\p{N})`

function phone(source: string): RegExp {
  return new RegExp(`${NOT_AFTER}${source}${NOT_BEFORE}`, 'gu')
}

// Matches a number that starts with a plus sign and country code, then groups of digits split by
// spaces, dots, hyphens or brackets, with eight or more digits in total. A range such as
// "+10 000 - 15 000" is rejected by its spaced hyphen. "+35%" has too few digits.
const PHONE_INTERNATIONAL = /(?<![\p{L}\p{N}+])\+\d[\d ()./-]{6,18}\d(?!\p{N})/gu

function isInternationalPhone(match: string): boolean {
  const digits = match.replace(/\D/g, '').length
  return digits >= MIN_PLUS_PHONE_DIGITS && !/ [-–—] /u.test(match)
}

// Matches a bracketed area code then two groups: (555) 010-0100.
const PHONE_BRACKETED = phone(String.raw`\(\d{2,4}\)[ .-]?\d{3,4}[ .-]?\d{3,4}`)

// Matches three groups of 3, 3 and 4 digits split by one space, dot or hyphen, with an optional
// leading 1: 555.010.0100. Date ranges, versions and salary figures never have this shape.
const PHONE_GROUPED = phone(String.raw`(?:1[ .-])?\d{3}[ .-]\d{3}[ .-]\d{4}`)

// Matches an international number written with the 00 prefix instead of a plus sign: a country
// code of one to three digits, then two to five more groups, each split by one space, dot or
// hyphen (0044 20 7946 0958, 00972-50-123-4567), or the same number with no separators
// (00447911123456). Eight or more digits must follow the 00. A spaced range such as
// "2018 - 2021" never matches, because a separator is exactly one character.
const PHONE_DOUBLE_ZERO = phone(String.raw`00(?:\d{1,3}(?:[ .-]\d{1,4}){2,5}|\d{8,15})`)

function isDoubleZeroPhone(match: string): boolean {
  return match.replace(/\D/g, '').length - 2 >= MIN_PLUS_PHONE_DIGITS
}

// Matches a national number with a leading zero: 050-1234567, 020 7946 0958 or 0501234567.
const PHONE_LEADING_ZERO = phone(
  String.raw`(?:0\d{1,2}[ .-]\d{7,8}|0\d{2,4}[ .-]\d{3,4}[ .-]\d{3,4}|0\d{9,10})`,
)

// Matches a bare run of exactly ten digits (5550100100). A year, a version, a percentage or a date
// range never has ten digits in a row, and a longer or shorter digit run is not touched.
const PHONE_BARE_TEN = phone(String.raw`\d{10}`)

// Street-type words. Abbreviations may carry a period, which goes with the address.
const STREET_FULL = [
  'Street',
  'Avenue',
  'Road',
  'Boulevard',
  'Lane',
  'Drive',
  'Court',
  'Place',
  'Square',
  'Terrace',
  'Highway',
  'Parkway',
]
const STREET_ABBREVIATED = ['St', 'Ave', 'Rd', 'Blvd', 'Ln', 'Hwy', 'Pkwy']
const STREET_TYPE = [
  ...STREET_FULL.flatMap((word) => [word, word.toUpperCase()]),
  ...STREET_ABBREVIATED.flatMap((word) => [`${word}\\.?`, `${word.toUpperCase()}\\.?`]),
].join('|')

// Matches a house number (optionally with a letter), one to four capitalised name words, a
// street-type word, an optional unit ("Apt 4B"), and an optional US "City, ST 12345" tail.
// Known false positive: a number followed by a capitalised name and a street word, such as
// "25 Park Avenue project". Lower-case addresses and addresses with no street word are missed.
const ADDRESS_STREET = new RegExp(
  String.raw`(?<![\p{L}\p{N}])\d{1,5}[A-Za-z]?(?:[ \t]+(?:\p{Lu}[\p{L}'’-]*|\d{1,3}(?:st|nd|rd|th))){1,4}[ \t]+(?:${STREET_TYPE})(?![\p{L}\p{N}])` +
    String.raw`(?:[ \t,]+(?:Apt|Apartment|Suite|Ste|Unit|Floor|Fl)\.?[ \t]*#?[\p{L}\p{N}-]{1,6})?` +
    String.raw`(?:,[ \t]*[^,\n]{1,40},[ \t]*[A-Z]{2}[ \t]+\d{5}(?:-\d{4})?)?`,
  'gu',
)

// Matches a post office box: P.O. Box 1234, PO Box 1234.
const ADDRESS_PO_BOX = /(?<![\p{L}\p{N}])P\.?[ \t]?O\.?[ \t]?Box[ \t]+\d{1,8}(?!\p{N})/giu

// Matches a UK postcode on its own: NW1 6XE. Only the postcode goes, so "London NW1 6XE" keeps
// the word London. It needs upper-case letters, so "Python3 6gb" and "3.8 s" never match.
const ADDRESS_UK_POSTCODE =
  /(?<![\p{L}\p{N}])[A-Z]{1,2}\d[A-Z\d]?[ \t]?\d[A-Z]{2}(?![\p{L}\p{N}])/gu

const RULES: readonly Rule[] = [
  { kind: 'email', pattern: EMAIL, placeholder: EMAIL_PLACEHOLDER },
  { kind: 'link', pattern: LINK_SCHEME, placeholder: LINK_PLACEHOLDER },
  { kind: 'link', pattern: LINK_WWW, placeholder: LINK_PLACEHOLDER },
  { kind: 'link', pattern: LINK_PROFILE_HOST, placeholder: LINK_PLACEHOLDER },
  {
    kind: 'phone',
    pattern: PHONE_INTERNATIONAL,
    placeholder: PHONE_PLACEHOLDER,
    accept: isInternationalPhone,
  },
  {
    kind: 'phone',
    pattern: PHONE_DOUBLE_ZERO,
    placeholder: PHONE_PLACEHOLDER,
    accept: isDoubleZeroPhone,
  },
  { kind: 'phone', pattern: PHONE_BRACKETED, placeholder: PHONE_PLACEHOLDER },
  { kind: 'phone', pattern: PHONE_GROUPED, placeholder: PHONE_PLACEHOLDER },
  { kind: 'phone', pattern: PHONE_LEADING_ZERO, placeholder: PHONE_PLACEHOLDER },
  { kind: 'phone', pattern: PHONE_BARE_TEN, placeholder: PHONE_PLACEHOLDER },
  { kind: 'address', pattern: ADDRESS_STREET, placeholder: ADDRESS_PLACEHOLDER },
  { kind: 'address', pattern: ADDRESS_PO_BOX, placeholder: ADDRESS_PLACEHOLDER },
  { kind: 'address', pattern: ADDRESS_UK_POSTCODE, placeholder: ADDRESS_PLACEHOLDER },
]

export function redactContactDetails(text: string): RedactionResult {
  const counts: RedactionCounts = { email: 0, phone: 0, address: 0, link: 0 }
  let result = text
  for (const rule of RULES) {
    result = result.replace(rule.pattern, (match) => {
      if (rule.accept && !rule.accept(match)) return match
      counts[rule.kind] += 1
      return rule.placeholder
    })
  }
  return { text: result, counts }
}
