# UpkeepBot

A Discord bot that tracks house upkeep payments for a game and posts an alert in the channel when an upkeep is about to expire (5 days out) and again when it has expired.

## Features

- `/upkeep <name> <days>` — record that upkeep for `<name>` was just paid and will last `<days>` days. Re-running with the same name updates the entry and resets its alert flags.
- `/upkeep-list` — list all tracked upkeep entries for the server, showing each entry's expiry time, cycle length, and the user who last paid.
- `/upkeep-remove <name>` — remove a tracked upkeep entry. Autocompletes the `name` option from the server's existing entries.
- Hourly background check sends one warning alert per cycle (≤5 days until expiration) and one expiry alert.
- Entries are scoped per server and persisted to SQLite, so they survive restarts.

## Project structure

```
├── src/
│   ├── index.js              # Client setup, interaction dispatch, scheduler bootstrap
│   ├── scheduler.js          # Hourly upkeep check + alert posting
│   ├── storage.js            # better-sqlite3 wrapper
│   ├── format.js             # Shared name-formatting utilities
│   └── commands/
│       ├── upkeep.js         # /upkeep slash command definition + handler
│       ├── upkeep-list.js    # /upkeep-list slash command definition + handler
│       └── upkeep-remove.js  # /upkeep-remove slash command (with autocomplete)
├── register.js               # One-shot script: registers slash commands with Discord
├── data/upkeep.db            # Created on first run; gitignored
└── package.json
```

## Setup

### Prerequisites

- Node.js 18+
- A [Discord application](https://discord.com/developers/applications) with a bot user, invited to your server with the `applications.commands` and `bot` (with **Send Messages**) scopes/permissions.

### 1. Install

```
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```
DISCORD_TOKEN=your-bot-token
APP_ID=your-application-id
```

Both are required. `DISCORD_TOKEN` is the bot token from the application's **Bot** tab; `APP_ID` is the application ID from the **General Information** tab.

### 3. Register the slash command

Run once after install, and again any time a command file under `src/commands/` changes:

```
npm run register
```

Global slash commands can take up to an hour to propagate.

### 4. Run the bot

```
npm start
```

Or for development with auto-reload:

```
npm run dev
```

## Usage

In any text channel where the bot can post:

### `/upkeep <name> <days>`

```
/upkeep MyHouse 60
```

- `name` — string, required, unique per server.
- `days` — positive integer, required.

The bot replies with the expiration date (rendered as a Discord relative timestamp, so it auto-localises per user). 5 days before expiration the bot pings the registering user in the same channel; another alert fires when the upkeep has expired. Running `/upkeep MyHouse 60` again resets both flags so alerts fire again next cycle.

### `/upkeep-list`

```
/upkeep-list
```

Lists every tracked upkeep entry for the server. Each line shows the entry name, whether it expires or has already expired (as a relative timestamp), the cycle length in days, and the user who last paid.

### `/upkeep-remove <name>`

```
/upkeep-remove MyHouse
```

Removes the named entry from tracking. The `name` field autocompletes from the server's existing entries — start typing and Discord shows a dropdown of matches. If no entry matches, the bot replies with an ephemeral error.

## Data

Upkeep entries live in `./data/upkeep.db` (SQLite). The path can be overridden with `UPKEEP_DB_PATH`. The directory is created automatically on startup. The bot opens the file in WAL mode for safe concurrent reads/writes.
