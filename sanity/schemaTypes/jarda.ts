import { defineField, defineType } from 'sanity';

/**
 * جردة — the monthly stocktake. Once a month, why the money went where it went, so
 * the ledger says more than what was spent.
 *
 * A separate type from `ledgerEntry` rather than a variant of it: it has no amount
 * and no direction, and there is at most one per month rather than many. The figures
 * shown beside it on the website — that month's in and out — are DERIVED from the
 * entries in `lib/ledger.ts`, never authored here. An editor able to type a total
 * could contradict the ledger printed directly beneath it, which on a transparency
 * page is the one bug that must not ship.
 *
 * ⚠ THIS FILE IS A MIRROR, NOT THE SOURCE OF TRUTH.
 *
 * The live schema on project 3a03n44v is MCP-managed: deployed through the Sanity
 * connector, not from a local Studio. Editing this file changes nothing on its own.
 * It exists so the shape lives in version control and so the type can be adopted
 * into a real Studio later.
 *
 * The deployed version is slightly reduced, because the MCP schema format accepts
 * declarative values only: the `validation` rules and `preview.prepare` below are
 * not deployed.
 */
export const jarda = defineType({
  name: 'jarda',
  title: 'جردة — Monthly stocktake',
  type: 'document',
  orderings: [
    {
      title: 'Month, newest first',
      name: 'monthDesc',
      by: [{ field: 'month', direction: 'desc' }],
    },
  ],
  fields: [
    defineField({
      name: 'month',
      title: 'Month',
      type: 'date',
      options: { dateFormat: 'YYYY-MM' },
      description:
        'The month this jarda reckons. One jarda per month — if two exist for the same month, only the most recently edited one is shown.',
      validation: (Rule) => Rule.required(),
    }),
    // Arabic first, matching `ledgerEntry` — Arabic is the primary language and the
    // field order is the order an editor should think in.
    defineField({
      name: 'titleAr',
      title: 'عنوان — Title (Arabic)',
      type: 'string',
      description:
        'Optional. Leave empty and the Arabic page uses the month name, e.g. "جردة تموز".',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'title',
      title: 'Title (English)',
      type: 'string',
      description:
        'Optional. Leave empty and the English page uses the month name, e.g. "July stocktake".',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'bodyAr',
      title: 'النص — The jarda (Arabic)',
      type: 'text',
      rows: 10,
      description:
        'Why the money went where it went. Leave a blank line between paragraphs. Shown on the Arabic page; if empty it falls back to the English text.',
      validation: (Rule) => Rule.max(4000),
    }),
    defineField({
      name: 'body',
      title: 'The jarda (English)',
      type: 'text',
      rows: 10,
      description:
        'Why the money went where it went. Leave a blank line between paragraphs. Shown on the English page; if empty it falls back to the Arabic text.',
      validation: (Rule) => Rule.max(4000),
    }),
  ],
  preview: {
    select: { month: 'month', titleAr: 'titleAr', title: 'title', bodyAr: 'bodyAr', body: 'body' },
    prepare({ month, titleAr, title, bodyAr, body }) {
      const written = (bodyAr ?? body ?? '').trim();
      return {
        title: titleAr ?? title ?? (month ? `جردة ${String(month).slice(0, 7)}` : 'Untitled jarda'),
        subtitle: written === '' ? 'Nothing written yet' : written.slice(0, 80),
      };
    },
  },
});
