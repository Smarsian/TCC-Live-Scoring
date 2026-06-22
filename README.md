# TCC Live Scoring

This repository powers the live scoreboard for The Coolio Championships.

The app is a Vite + React site in [tcc-scores](tcc-scores), and the scoring data is generated from the raw text files in [tcc-scores/data/Scoring/RawData](tcc-scores/data/Scoring/RawData).

## Project Layout

- [tcc-scores/src](tcc-scores/src) contains the site UI.
- [tcc-scores/data/Parser/scoreParser.py](tcc-scores/data/Parser/scoreParser.py) converts a raw `.txt` scoring file into JSON.
- [tcc-scores/data/Scoring/JSON-data](tcc-scores/data/Scoring/JSON-data) stores the generated event JSON used by the site.
- [tcc-scores/data/Scoring/RawData](tcc-scores/data/Scoring/RawData) stores the source `.txt` files.
- [tcc-scores/data/events.json](tcc-scores/data/events.json), [tcc-scores/data/games.json](tcc-scores/data/games.json), and [tcc-scores/data/teams.json](tcc-scores/data/teams.json) provide the event metadata, game definitions, and team metadata used by the UI.

## Run Locally

To view the site without deploying it, run the app from the [tcc-scores](tcc-scores) folder:

```bash
npm run dev -- --host
```

Vite will print a local URL, usually something like `http://localhost:5173/TCC-Live-Scoring/`.

## Updating Scores

1. Add or update the raw scoring file in [tcc-scores/data/Scoring/RawData](tcc-scores/data/Scoring/RawData).
2. From [tcc-scores/data/Parser](tcc-scores/data/Parser), run:

```bash
python scoreParser.py TCC{Name of Event}-Points.txt
```

3. The parser writes a matching JSON file into [tcc-scores/data/Scoring/JSON-data](tcc-scores/data/Scoring/JSON-data).
4. The site reads that JSON automatically when the filename matches the event’s `points` value in [tcc-scores/data/events.json](tcc-scores/data/events.json).

## Event Workflow

Before or during an event:

1. Create a raw file named `TCC{Name of Event}-Points.txt` in [tcc-scores/data/Scoring/RawData](tcc-scores/data/Scoring/RawData).
2. Put the event name on the first line.
3. Add a `Teams:` section with each team name followed by the players on that team.
4. Add a `Games:` section, then list each game and its `Points:` block.
5. Keep [tcc-scores/data/events.json](tcc-scores/data/events.json) updated with the correct game order and any multiplier settings.

After each score update, rerun the parser so the JSON stays in sync.

## Deploy

From [tcc-scores](tcc-scores), run:

```bash
npm run deploy
```

That command builds the app, commits the changes, and pushes to `main` so GitHub Pages can publish the update.

## After The Event

Update the final event metadata in [tcc-scores/data/events.json](tcc-scores/data/events.json), including:

- `winner`
- `runner-up`
- `score`
- `is-live`

Then run `npm run deploy` again to publish the final state.