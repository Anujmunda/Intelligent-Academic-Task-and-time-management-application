# Intelligent-Academic-Task-and-time-management-application
## DESCRIPTION:
Intelligent Academic Task and Time Management Application is a sophisticated productivity ecosystem built on Node.js, specifically engineered to empower students and researchers in optimizing their academic schedules. By integrating a versatile web dashboard with a high-performance command-line interface (CLI), the application offers flexibility for all user workflows. Core functionalities include a secure authentication system, persistent database management for task tracking, and a rigorous testing suite to ensure platform stability. This intelligent tool streamlines time management, allowing users to prioritize deadlines, manage complex projects, and maintain a balanced academic life through data-driven task organization

## Features

### Authentication
- Email and password sign-in
- Google OAuth support
- Password reset flow
- Supabase session handling

### Dashboard
- Personalized welcome state
- Productivity score, completed tasks, streak, and reward points
- Today's tasks panel
- Risk alerts for urgent and overdue items
- Upcoming deadline list
- Weekly progress chart

### Task Management
- Create, edit, and delete tasks
- Deadline, priority, description, and status tracking
- Filters for all, pending, completed, and overdue work
- Sorting by deadline, priority, or created date
- One-click completion updates

### Analytics and Goals
- Completion rate and total task stats
- Weekly completion trend chart
- Task distribution and priority breakdown charts
- Goal creation, completion, and deletion
- Reward and achievement tracking

### Study Schedule
- Schedule generation based on pending tasks
- Priority-aware time allocation
- Balanced daily workload planning
- Per-day schedule display

## Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js
- Supabase JS client

### Backend
- Node.js
- Express
- Supabase
- node-cron

### Database
- Supabase PostgreSQL
- Tables: `user_profiles`, `tasks`, `study_logs`, `goals`, `rewards`, `study_schedule`

## Project Structure
```
academic-task-manager/
├── frontend/
│   ├── index.html (Landing/Login)
│   ├── signup.html
│   ├── dashboard.html
│   ├── tasks.html
│   ├── analytics.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── tasks.js
│   │   ├── analytics.js
│   │   └── config.js
│   └── assets/
│       └── icons/
├── backend/
│   ├── server.js (Node.js)
│   ├── routes/
│   │   ├── tasks.js
│   │   ├── analytics.js
│   │   └── rewards.js
│   └── utils/
│       ├── scheduler.js
│       └── notifications.js
├── database/
│   └── schema.sql
├── package.json
└── README.md

## Setup

### Prerequisites
- Node.js 14+
- npm
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run [`database/schema.sql`](./database/schema.sql).
4. Optionally run [`database/sample-data.sql`](./database/sample-data.sql).

Get these values from Supabase:
- Project Settings > API > Project URL
- Project Settings > API > anon/public key

### 3. Create `.env`

Use the root `.env.example` as a template:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Start the app

```bash
npm start
```

For auto-reload during development:

```bash
npm run dev
```

The application is served from:
- App: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## Usage

### First run

1. Open `http://localhost:3000`.
2. Create an account from `Sign Up`.
3. Verify your email if your Supabase auth settings require it.
4. Sign in and start creating tasks.

### Main flow

1. Create tasks with deadlines and priorities.
2. Mark tasks complete from the dashboard or task list.
3. Generate a study schedule from the Tasks page.
4. Track progress and goals on the Analytics page.

## Current Runtime Notes

- The frontend is now served directly by the Express backend.
- You do not need Live Server, `python -m http.server`, or a second frontend port.
- Frontend Supabase settings are already wired in [`frontend/js/config.js`](./frontend/js/config.js).
- Password reset now uses [`frontend/reset-password.html`](./frontend/reset-password.html).
- Most user-facing data loading is handled directly through the authenticated Supabase client in the browser.

## Productivity Logic

### Productivity score

`(completed tasks / total tasks) * 100`

### Study streak

- Increases when a user completes tasks on consecutive days
- Resets when a day is missed

### Study schedule generation

1. Load pending tasks
2. Sort by priority and deadline
3. Assign hours by priority
4. Limit planned workload to 6 hours per day
5. Store the generated schedule in `study_schedule`

## Security

- Supabase Auth for authentication
- Row Level Security enabled in the schema
- Per-user data isolation through Supabase policies

## Troubleshooting

### Server does not start
- Make sure Node.js is installed and available
- Check that `.env` exists in the project root
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Run `npm install` again if dependencies are missing

### App loads but auth or data fails
- Confirm your Supabase schema has been applied
- Check browser console errors
- Verify your Supabase project is active
- Make sure your auth provider settings match your local URL

### Password reset or Google login redirects fail
- Add your local callback URLs in Supabase Authentication settings
- Include `http://localhost:3000/reset-password.html`
- Include `http://localhost:3000/dashboard.html`

## API Endpoints

These routes exist on the Express server:

### Health
- `GET /api/health`

### Tasks
- `GET /api/tasks/:userId`
- `POST /api/tasks`
- `PUT /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `POST /api/tasks/:taskId/complete`
- `GET /api/tasks/:userId/alerts`

### Analytics
- `GET /api/analytics/:userId/weekly`
- `GET /api/analytics/:userId/trends`
- `GET /api/analytics/:userId/insights`

### Rewards
- `GET /api/rewards/:userId`
- `POST /api/rewards`
- `POST /api/rewards/:userId/streak`

### Schedule
- `POST /api/schedule/generate`

Note: the current frontend mainly uses the authenticated Supabase client directly for user data operations.

## License

MIT
