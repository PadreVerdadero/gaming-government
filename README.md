# Gaming Government

An online adaptation of **Nomic** — the game where changing the rules is a move.

Convene a multiplayer chamber in the browser: propose rule-changes, debate on **The Floor**, whisper in **The Cloakroom**, vote by roll call, and track points until someone reaches the computer-game win threshold (200).

## Features

- **Multiplayer chambers** with shareable codes
- **No login accounts** — each legislator gets **Credentials of Office** (a seat token) stored in the browser; copy them to reconvene from another device
- **Recess / reconvene** — leave for hours or days; room state is saved on disk under `data/chambers/`
- **The Floor** — public chat for debate
- **The Cloakroom** — private 1:1 whispers
- **Living statute book** — Initial Set plus adopted proposals; gold immutable / blue mutable / red amended·repealed (archived hidden by default)
- **Manual scores & dials** — click a name for +1/−1; edit win threshold and % aye needed to pass (no fixed turn order)

The software is a ledger for proposals, votes, and rule text. Points, passage math, and turn customs stay player-controlled so later rule-changes don’t fight the UI. Judgment (Rule 212) stays with the players.

## Quick start

```bash
npm install
npm run dev
```

- Web UI: [http://localhost:3000](http://localhost:3000)
- Chamber server (Socket.io): [http://localhost:3001](http://localhost:3001)

Optional: copy `.env.example` to `.env.local` and adjust URLs.

## How to play

1. **Convene** a chamber (host) or **Take a seat** with a chamber code.
2. Save or copy your **Credentials of Office** (shown via “Copy Credentials of Office” in-chamber).
3. Host clicks **Gavel open** when everyone has joined.
4. On your turn: introduce a bill → debate on The Floor → open roll call → everyone votes Aye/Nay → points update → next member.
5. Need a break? Hit **Recess**. Later use **Reconvene** (or a Recent recess link) with the same credentials.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Socket.io chamber server with JSON file persistence
- Shared game logic in `shared/`

## GitHub

Create a repo and push:

```bash
git add .
git commit -m "Initial Gaming Government chamber"
gh repo create gaming-government --public --source=. --remote=origin --push
```

## Design notes (Nomic)

Peter Suber warns that programs can accidentally become the Judge. This app intentionally does **not** resolve legality disputes, paradox wins (Rule 213), or custom rule semantics beyond the Initial Set procedures it implements. If a later rule-change would require different software behavior, players should treat the app as a ledger and agree how to proceed — or amend the rules to match what the chamber can enforce.
