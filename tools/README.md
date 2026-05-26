# Tools

Internal utilities for maintaining the scammer list.

---

## `discord_uid.js`

Fetches Discord user data for every ID found in `data.json` and writes the result to `discord.json`. Requires a Discord bot token.

### Setup

1. Ensure you are running Node.js 18 or later.

2. Install dependencies:
   ```
   npm install dotenv
   ```

2. Create a `.env` file in this directory:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   ```

### Usage

```
node discord_uid.js --export-discord
```

Writes `discord.json` to the project root.

```
node discord_uid.js --count-discord
```

Prints the number of unique Discord IDs found in `data.json` without making any API calls.

---

## `admin.html`

Open directly in a browser. No server required.