# HeisenLink

**The science of social connection.**

HeisenLink is a minimalist Reddit-style social media app with Django, DRF, JWT auth, Google OAuth ID token login, PostgreSQL, Redis-backed Django Channels notifications, and a React frontend.

## Folder Structure

```text
HeisenLink/
  backend/
    heisenlink/          Django project settings, URLs, ASGI, WSGI
    accounts/           Custom user, profiles, follows, auth endpoints
    communities/        Subreddit-like communities
    posts/              Posts, feed, post comments, post voting
    comments/           Nested comments and comment voting
    votes/              Generic vote model and vote services
    notifications/      REST + WebSocket real-time notifications
    manage.py
    requirements.txt
    .env.example
  frontend/
    src/
      api/              Axios client and JWT refresh
      components/       Navbar, post cards, comments, voting
      context/          Auth context
      hooks/            WebSocket notifications
      pages/            Auth, feed, post detail, profile
    package.json
    .env.example
  docker-compose.yml
```

## Local Setup

1. Start PostgreSQL and Redis:

```bash
docker compose up -d
```

2. Configure the backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py createsuperuser
python manage.py runserver
```

3. Configure the frontend in a second terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

4. Open `http://localhost:5173`.

## Demo Data

After `python manage.py seed_demo`, you can login with:

```text
username: walter
password: Password123!
```

The seed command also creates `jesse`, `skyler`, sample communities, posts, nested comments, and votes.

## Google OAuth

Create a Google OAuth Web Client ID in Google Cloud Console and set it in both files:

```text
backend/.env:  GOOGLE_CLIENT_ID=...
frontend/.env: VITE_GOOGLE_CLIENT_ID=...
```

The frontend receives the Google credential with `@react-oauth/google`; the backend verifies it with `google-auth` before issuing JWT access and refresh tokens.

## Local OTP Emails

For the local no-Docker setup, `backend/.env` uses Django's file email backend. Verification and password reset OTP emails are written to:

```text
D:\HeisenLink\logs\emails
```

## API Endpoints

```text
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/google/
POST /api/auth/verify-email/
POST /api/auth/resend-otp/
POST /api/auth/forgot-password/
POST /api/auth/reset-password/
GET  /api/me/
GET  /api/users/{id}/
POST /api/users/{id}/follow/
GET  /api/feed/
GET  /api/posts/
POST /api/posts/
GET  /api/posts/{id}/
POST /api/posts/{id}/vote/
POST /api/posts/{id}/comment/
GET  /api/comments/{id}/
POST /api/comments/{id}/vote/
GET  /api/communities/
POST /api/communities/
GET  /api/notifications/
POST /api/notifications/read/
WS   /ws/notifications/?token={access_token}
```

## Notes

- PostgreSQL is preferred through `DATABASE_URL`; if no `DATABASE_URL` is present, Django falls back to SQLite for quick local experiments.
- Redis powers Channels. Keep the Redis container running for live notifications.
- JWT tokens are handled by Axios interceptors and refreshed automatically when possible.
