# NASFAT Parent Portal

I built this portal for NASFAT Manchester Madrasa to make it easier for parents, teachers, and admins to keep up with students' progress without relying on messages or manual Supabase edits.

It is designed primarily for phones, since that is how most parents and staff will use it.

## What it does

### Parents

- Sign in with a simple username and password.
- See every student linked to their account.
- See which class each student is in and their current Saturday attendance percentage.
- View behaviour points for today and each student's overall total.
- View the latest Quran, Islamic Studies, and Arabic exam results.
- Open past exam results when exam history is available.

### Admins and staff

- Choose a class and log daily behaviour points for students.
- Add teacher notes for parents to see.
- Manage students: add them, edit names and groups, archive students who leave, and restore them later.
- Manage parent accounts and link one or more students to each parent.
- Create and edit staff accounts, reset passwords, and archive or restore staff access.
- Create and rename classes.
- Mark the Saturday attendance register; unmarked students count as absent from Sunday.
- Add, edit, and review Quran, Islamic Studies, and Arabic exam results by exam month.

## Why I made it

The aim is to give NASFAT Manchester one simple place for madrasa progress. Parents should only need the username and password they are given, while admins can manage routine records from the portal instead of directly editing the database.

Student history is kept when a student or parent is archived, so points, notes, exam results, and family links can be restored when needed.

## Built with

- Next.js with the App Router
- TypeScript and React
- Supabase Auth and Postgres
- Vercel for deployment
- Inline React style objects with a mobile-first NASFAT visual style

## Main routes

| Route | Purpose |
| --- | --- |
| `/login` | Username and password sign-in |
| `/parent` | Parent view of linked students, points, and exam results |
| `/admin` | Admin dashboard, class point logging, and management links |
| `/admin/classes/[classId]` | Daily class points and teacher notes |
| `/admin/students` | Student management |
| `/admin/parents` | Parent account and student-link management |
| `/admin/staff` | Staff account and access management |
| `/admin/classes/manage` | Class management |
| `/admin/attendance` | Saturday attendance register for admins and staff |
| `/admin/exams` | Exam result entry and history |

## Attendance calculation

Attendance starts at 100% for a newly assigned or restored student. Each Saturday class joins the total on Sunday, so the percentage is calculated from attended Saturday classes divided by completed Saturday classes. This makes the value update automatically without a scheduled job.
