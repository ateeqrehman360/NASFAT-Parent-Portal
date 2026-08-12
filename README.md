# NASFAT Parent Portal

A mobile-first Next.js and Supabase portal for NASFAT Manchester families and madrasa administrators.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin management setup

Before deploying the admin management screens:

1. Run [`supabase/migrations/20260811_admin_management.sql`](./supabase/migrations/20260811_admin_management.sql) in the Supabase SQL editor. It uses the existing `students.active` column, keeps current students active, and adds an active-class index.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel and to the local server environment. Keep it server-only: never prefix it with `NEXT_PUBLIC_`.

Management requests are handled by `/api/admin/manage`. The route validates the caller's Supabase session and checks `profiles.role = 'admin'` before using the server-only service-role client. Existing RLS policies are intentionally not changed, so parent visibility rules remain in effect.

New parent accounts use `username@parent.nasfat-manchester.internal` solely as the internal Supabase Auth email. Parents continue to log in with their username and password.

Parent archiving is reversible and does not delete profiles, relationships, or history. The management route uses Supabase Auth's server-only `ban_duration` setting to block an archived parent from signing in, and removes that ban when the account is restored. Existing RLS policies are not changed.

## Exam results setup

Run these in order in the Supabase SQL editor before using exam results:

1. [`supabase/migrations/20260812_exam_results.sql`](./supabase/migrations/20260812_exam_results.sql) creates the new `exam_results` table for Quran, Islamic Studies, and Arabic, with one result per student and exam date.
2. [`supabase/migrations/20260812_exam_result_score_totals.sql`](./supabase/migrations/20260812_exam_result_score_totals.sql) adds optional maximum marks so results can be displayed as, for example, `35/40`.
3. [`supabase/migrations/20260812_exam_result_historic_assessments.sql`](./supabase/migrations/20260812_exam_result_historic_assessments.sql) allows a labelled historic result when the original exam date is unknown, without changing dated-result history.
4. [`supabase/migrations/20260812_exam_result_month_cycles.sql`](./supabase/migrations/20260812_exam_result_month_cycles.sql) consolidates results into one row per student and exam month. Existing supplied results are assigned to July 2026, and future dates are stored as the first day of their month internally.

- Parents can read only results for students linked to their own account through `parent_student`.
- Browser clients have read-only access to the table; writes go through `/api/admin/manage` after the server verifies that the signed-in profile has the `admin` or `staff` role.
- Admins open **Exam results** from `/admin`; a `staff` profile is routed directly to `/admin/exams` after logging in.

In the entry form, select the exam month and write a result as `35/40` to retain the mark and its total, or just `35` when there is no fixed maximum. Saving another subject for the same student and month adds it to that month without erasing existing subjects. A later exam month appears as a separate history entry.
