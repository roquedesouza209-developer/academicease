# AcademicEase

AcademicEase is an academic results management system built to replace spreadsheets and manual calculations with a cleaner digital workflow.

## Current milestone

This repository now has a `Next.js` app-router foundation with the existing MVP experience migrated into a client component.

- Student marks entry with editable subject rows
- Automatic totals, averages, grades, and remarks
- Class performance analytics and ranking
- Printable report cards that work well with browser PDF saving
- Local device storage through browser `localStorage`
- JSON backup/import and CSV export

## Run locally

1. Make sure Node.js is installed.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Main files

- `app/layout.js` sets the root layout and metadata
- `app/page.js` renders the main AcademicEase app
- `app/globals.css` contains the UI design and print styles
- `components/AcademicEaseApp.jsx` contains the interactive client-side workflow
- `lib/academicease.js` contains shared scoring, ranking, analytics, and state helpers

## Notes

- Data is still stored locally in the browser for this phase.
- Use `Export Data` to create a JSON backup and `Import Data` to restore it later.
- Use `Print / Save PDF` to open the browser print dialog and save a report as PDF.
- The next logical step is adding a real database and user authentication on top of this structure.
