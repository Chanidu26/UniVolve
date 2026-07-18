# VMS — Local Development

## Run
```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api (health: /health)
- MailHog (view sent emails): http://localhost:8025
- PostgreSQL: localhost:5432 (vms / vms_password / vmsdb)

## Seeded account
- Super Admin: `admin@university.lk` / `Admin@123`

## Flow to test
1. Register a volunteer account.
2. Login as super admin → Admin tab → create + publish an event.
3. Assign the volunteer's user ID as Organizer (copy from DB or /auth/me).
4. Organizer adds roles via Manage Event; volunteers apply; organizer approves/rejects.
5. Check MailHog for status-change emails.
