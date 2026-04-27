# SportStack

A comprehensive sports management platform designed to streamline operations for clubs, associations, and teams.

## Features

- **Entity Management**: Hierarchical management of Associations, Clubs, and Teams.
- **Role-Based Access**: Specialized views and capabilities for Players, Coaches, Team Managers, Club Admins, and Super Admins.
- **Fixtures & Venues**: Comprehensive scheduling and venue management.
- **Roster Management**: Manage players and team line-ups.

## Development

This project is built with React, Vite, and Tailwind CSS, leveraging Supabase for the backend.

### Prerequisites

- Node.js (v18+)
- npm
- Supabase account and local CLI (optional, for local DB)

### Running Locally

1. Clone the repository
2. Run `npm install`
3. Start the dev server: `npm run dev`

### Environment Variables

You need to set up the following environment variables in your `.env` file:
```
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_URL=your_supabase_url
```

## Deployment

This application is ready to be deployed to Vercel. Connect your repository to Vercel and set the required environment variables in the Vercel dashboard.

## Authentication

Google Single Sign-On (SSO) is supported. Ensure that the Google OAuth provider is enabled in your Supabase project settings, and that your production URL is added to the Supabase Redirect URLs.
