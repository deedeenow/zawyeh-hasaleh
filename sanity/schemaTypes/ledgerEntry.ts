import { defineField, defineType } from 'sanity';

/**
 * One movement of money through the Hasaleh. One entry, one document — so two
 * people recording entries at the same time can never overwrite each other, and
 * every figure carries its own revision history.
 *
 * This file belongs to the Studio, not to the Next app. Copy it into your Studio
 * project's schema folder (see the README) — the Next app only ever reads.
 */
export const ledgerEntry = defineType({
  name: 'ledgerEntry',
  title: 'Ledger entry',
  type: 'document',
  // Newest first, matching how the website lists them.
  orderings: [
    {
      title: 'Date, newest first',
      name: 'dateDesc',
      by: [{ field: 'date', direction: 'desc' }],
    },
  ],
  fields: [
    defineField({
      name: 'kind',
      title: 'Direction',
      type: 'string',
      description: 'Did the money come in, or go out?',
      options: {
        list: [
          { title: 'Money in', value: 'in' },
          { title: 'Money out', value: 'out' },
        ],
        layout: 'radio',
      },
      initialValue: 'out',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'amount',
      title: 'Amount',
      type: 'number',
      description:
        'Always a positive number — the direction above decides the sign. Up to two decimal places.',
      validation: (Rule) =>
        Rule.required()
          .positive()
          .custom((value) => {
            if (typeof value !== 'number') return true;
            const cents = value * 100;
            // Guard against 12.345, which would silently round on the website.
            if (Math.abs(cents - Math.round(cents)) > 1e-9) {
              return 'Use at most two decimal places.';
            }
            return true;
          }),
    }),
    defineField({
      name: 'label',
      title: 'What for',
      type: 'string',
      description: 'Shown on the website exactly as written. Keep it plain and specific.',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      description: 'When the money actually moved, not when it was recorded here.',
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'text',
      rows: 2,
      description: 'Optional. One extra line of context, shown under the entry.',
      validation: (Rule) => Rule.max(400),
    }),
  ],
  preview: {
    select: { label: 'label', amount: 'amount', kind: 'kind', date: 'date' },
    prepare({ label, amount, kind, date }) {
      const sign = kind === 'in' ? '+' : '−';
      const figure = typeof amount === 'number' ? amount.toLocaleString('en-US') : '?';
      const when = date ? new Date(date).toLocaleDateString('en-GB') : 'no date';
      return { title: label ?? 'Untitled entry', subtitle: `${sign}${figure} · ${when}` };
    },
  },
});
