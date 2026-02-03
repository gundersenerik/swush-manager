# SWUSH Manager

API platform for Aftonbladet's fantasy games powered by SWUSH Partner API. Provides personalized game data to Braze for marketing campaigns.

## Features

- **Data Sync**: Automatic synchronization of game data, player elements, and user statistics from SWUSH
- **Braze Connected Content**: REST API endpoint for personalized user data in email/push campaigns
- **Campaign Triggers**: Automated Braze triggers for deadline reminders, round start/end events
- **Admin Dashboard**: UI for managing games, viewing sync logs, configuring triggers, and managing API keys

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your credentials:

- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **SWUSH**: Get your Partner API key from SWUSH
- **Braze**: Get your REST API key and endpoint from Braze dashboard

### 3. Set Up Database

Run the schema in your Supabase SQL editor:

```bash
# Copy contents of supabase/schema.sql to Supabase SQL Editor
```

### 4. Create Admin User

In Supabase Dashboard → Authentication → Users, create a new user with email/password for admin access.

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Braze Connected Content

```
GET /api/v1/users/{externalId}/games/{gameKey}
Header: x-api-key: your-api-key
```

Returns personalized user data:
- User statistics (points, rank, last round points)
- Current lineup with player details
- Player alerts (injured, suspended)
- Trending players
- Game deadlines

**Braze Usage Example:**
```liquid
{% connected_content https://your-domain.vercel.app/api/v1/users/{{${user_id}}}/games/os-2026 :headers {"x-api-key": "your-api-key"} :save response %}

Hi there! You're ranked #{{response.user.rank}} with {{response.user.total_points}} points.

{% if response.alerts.injured | size > 0 %}
⚠️ Injured players in your lineup:
{% for player in response.alerts.injured %}
- {{player.name}}
{% endfor %}
{% endif %}
```

### Admin API

All admin endpoints require authentication via Supabase Auth session.

- `GET/POST /api/admin/games` - List/create games
- `GET/PUT/DELETE /api/admin/games/[id]` - Game CRUD
- `POST /api/admin/games/[id]/sync` - Trigger manual sync
- `GET/POST /api/admin/api-keys` - Manage API keys
- `GET /api/admin/sync-logs` - View sync history

### Cron Endpoints

Protected by `CRON_SECRET` header:

- `GET /api/cron/sync` - Sync games due for update (every 15 min)
- `GET /api/cron/triggers` - Check and fire Braze triggers (hourly)

## Vercel Deployment

### 1. Connect Repository

Link your GitHub repo to Vercel.

### 2. Configure Environment Variables

Add all variables from `.env.example` to Vercel project settings.

### 3. Set Up Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/triggers",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 4. Deploy

```bash
vercel --prod
```

## Project Structure

```
swush-manager/
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # Admin UI routes
│   │   ├── api/
│   │   │   ├── admin/       # Admin API endpoints
│   │   │   ├── cron/        # Scheduled job endpoints
│   │   │   └── v1/          # Public API (Braze)
│   │   └── login/           # Auth pages
│   ├── lib/
│   │   └── supabase/        # Database clients
│   ├── services/
│   │   ├── swush-client.ts  # SWUSH API client
│   │   ├── sync-service.ts  # Data synchronization
│   │   └── braze-trigger-service.ts
│   └── types/               # TypeScript interfaces
├── supabase/
│   └── schema.sql           # Database schema
└── vercel.json              # Cron configuration
```

## Data Flow

1. **Sync Service** fetches data from SWUSH Partner API
2. Data is stored in Supabase (games, elements, user_game_stats)
3. **Braze Connected Content** queries Supabase for user data
4. **Trigger Service** checks conditions and fires Braze campaigns

## License

Internal Schibsted/Aftonbladet project.
