# VMS — Local Development

## Run
```bash
docker compose up --build
```

Two separate SPAs, matching the CA01 Component/Deployment Diagrams (Organizer is a per-event
permission on a Volunteer, not its own portal):

- Volunteer Portal: http://localhost:3000 (browse/apply for events, my applications, profile,
  organizer's Manage Event)
- Admin Portal: http://localhost:3001 (create/publish/manage events, assign organizers)
- Backend API: http://localhost:4000/api (health: /health)
- MailHog (view sent emails): http://localhost:8025
- PostgreSQL: localhost:5432 (vms / vms_password / vmsdb)

## Seeded account
- Super Admin: `admin@university.lk` / `Admin@123` (log in via the Admin Portal — there's no
  self-registration for admins; volunteers register through the Volunteer Portal).

## Flow to test
1. Register a volunteer account on the Volunteer Portal (:3000).
2. Login as super admin on the Admin Portal (:3001) → create + publish an event.
3. Assign the volunteer's user ID as Organizer (copy from DB or /auth/me).
4. Organizer logs into the Volunteer Portal, clicks "Manage Event" on their assigned event, adds
   roles; volunteers apply; organizer approves/rejects.
5. Check MailHog for status-change emails.
