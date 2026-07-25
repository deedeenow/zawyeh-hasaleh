/**
 * Arabic is the primary language; English is the alternate. That order matters
 * structurally, not just in the copy: RTL is the base layout in globals.css and
 * LTR is the override, which is the cheaper direction to maintain.
 *
 * Entry text (label, note) is shown exactly as typed in the Studio — it is not
 * translated. Bilingual entries would need `label_ar` / `label_en` on the Sanity
 * schema and someone willing to type both.
 */

export type Locale = 'ar' | 'en';

/**
 * Picks the text for a locale, falling back to the other language rather than
 * rendering nothing. A half-translated entry is still worth showing — and the
 * Studio only warns about a missing Arabic label, it does not block publishing.
 */
export function pickText(
  entry: { label: string; labelAr?: string },
  locale: Locale,
): string {
  return locale === 'ar' ? (entry.labelAr ?? entry.label) : (entry.label ?? entry.labelAr ?? '');
}

export function pickNote(
  entry: { note?: string; noteAr?: string },
  locale: Locale,
): string | undefined {
  return locale === 'ar' ? (entry.noteAr ?? entry.note) : (entry.note ?? entry.noteAr);
}

export const DEFAULT_LOCALE: Locale = 'ar';

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
};

export interface Dictionary {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  /** Path to the other language. */
  altHref: string;
  /** Label for the language toggle, written in the language it switches TO. */
  altLabel: string;
  brand: string;
  wordmark: string;
  /** Display form of the currency. The API reports the ISO code separately. */
  currency: string;
  about: string;
  balanceLabel: string;
  emptyReadout: string;
  lastIn: string;
  lastOut: string;
  totalIn: string;
  totalOut: string;
  ledgerTitle: string;
  columnIn: string;
  columnOut: string;
  emptyTitle: string;
  emptyBody: string;
  srMoneyIn: string;
  srMoneyOut: string;
  aboutTitle: string;
  aboutBody: string[];
  aboutClose: string;
  /** Arabic needs dual and two plural forms; English needs one. */
  entryCount: (n: number) => string;
  /**
   * Localises the digits in an already-formatted string. Arabic-Indic digits on
   * the Arabic page; identity in English.
   */
  digits: (value: string) => string;
}

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Swaps Western digits for Arabic-Indic ones (U+0660–U+0669).
 *
 * Deliberately leaves "." and "," alone rather than substituting the Arabic
 * decimal (U+066B) and thousands (U+066C) separators: those are patchily supported
 * in fonts and would risk tofu, and Arabic-Indic digits alongside ASCII separators
 * is what most real-world Jordanian signage and interfaces use. To switch, map
 * them here — it is the only place digits are localised.
 */
function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

const ar: Dictionary = {
  locale: 'ar',
  dir: 'rtl',
  altHref: '/en',
  altLabel: 'English',
  brand: 'زاوية',
  wordmark: 'حصالة',
  currency: 'د.أ',
  about: 'عن الحصالة',
  balanceLabel: 'في الحصالة',
  emptyReadout: 'فارغة. لا وارد ولا صادر.',
  lastIn: 'آخر وارد',
  lastOut: 'آخر صادر',
  totalIn: 'الوارد',
  totalOut: 'الصادر',
  ledgerTitle: 'السجل',
  columnIn: 'وارد',
  columnOut: 'صادر',
  emptyTitle: 'لم تتحرك أي مبالغ في الحصالة بعد.',
  emptyBody: 'سيظهر أول قيد هنا.',
  srMoneyIn: 'وارد، ',
  srMoneyOut: 'صادر، ',
  aboutTitle: 'عن الحصالة',
  aboutBody: [
    'الحصالة هي صندوق نقود زاوية. كل مبلغ يدخلها أو يخرج منها مُسجَّل هنا، بالكامل وعلى الملأ.',
    'الرقم في المنتصف هو الرصيد الحالي: مجموع الوارد ناقص مجموع الصادر. الجسم الدوّار هو الحصالة نفسها، ممسوحة ثلاثية الأبعاد ومعروضة بلون واحد.',
    'يتغيّر حجم الحصالة قليلاً مع الرصيد، وتنبض عند كل حركة جديدة. السجل مقسوم إلى وارد وصادر، والقيد الأحدث هو المعكوس لونه.',
    'تُسجَّل القيود في زاوية ويظهر أثرها هنا خلال ثوانٍ. لا شيء يُحذف بصمت: لكل قيد تاريخ تعديلات محفوظ.',
  ],
  aboutClose: 'إغلاق',
  entryCount: (n) => {
    const d = toArabicDigits(String(n));
    if (n === 0) return 'لا قيود';
    if (n === 1) return 'قيد واحد';
    if (n === 2) return 'قيدان';
    if (n <= 10) return `${d} قيود`;
    return `${d} قيداً`;
  },
  digits: toArabicDigits,
};

const en: Dictionary = {
  locale: 'en',
  dir: 'ltr',
  altHref: '/',
  altLabel: 'العربية',
  brand: 'Zawyeh',
  wordmark: 'حصالة',
  currency: 'JOD',
  about: 'About',
  balanceLabel: 'In the hasaleh',
  emptyReadout: 'Empty. Nothing in, nothing out.',
  lastIn: 'Last in',
  lastOut: 'Last out',
  totalIn: 'In',
  totalOut: 'Out',
  ledgerTitle: 'The Ledger',
  columnIn: 'In',
  columnOut: 'Out',
  emptyTitle: 'Nothing has moved through the hasaleh yet.',
  emptyBody: 'The first entry will show up here.',
  srMoneyIn: 'Money in, ',
  srMoneyOut: 'Money out, ',
  aboutTitle: 'About the hasaleh',
  aboutBody: [
    'The hasaleh is Zawyeh’s money box. Every amount that goes into it or comes out of it is recorded here, in full and in public.',
    'The figure in the middle is the current balance: everything in, minus everything out. The turning object is the hasaleh itself — the real one, 3D-scanned and drawn in a single colour.',
    'It changes size a little with the balance, and flinches whenever a new amount lands. The ledger splits into money in and money out; the newest entry is the inverted row.',
    'Entries are recorded at Zawyeh and show up here within seconds. Nothing is removed quietly — every entry keeps its own edit history.',
  ],
  aboutClose: 'Close',
  entryCount: (n) => (n === 1 ? '1 entry' : `${n} entries`),
  digits: (value) => value,
};

export const DICTIONARIES: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
