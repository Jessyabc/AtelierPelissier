# Where Your Data Is Stored

**Your data is saved on your computer**, not just in the browser.

## Database location

All projects, service calls, clients, and other data are stored in a **SQLite database file**:

```
prisma/dev.db
```

This file lives in your project folder. When you:
- Create a project
- Add a service call
- Save client info
- etc.

…the data is written to this file on your hard drive. It persists after you:
- Close the browser
- Stop the dev server
- Restart your computer

## Backup / Export

Use **Settings → Export data** in the app to download a JSON backup of all your data. Save it wherever you like (Desktop, Documents, external drive) for extra safety.
