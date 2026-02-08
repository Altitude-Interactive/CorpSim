# CorpSim New PC Bootstrap

Use this checklist to clone the repo on a different machine and reach the same runnable state.

## 1) Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (Compose)
- Git

## 2) Clone and install

```bash
git clone https://github.com/BENZOOgataga/CorpSim.git
cd CorpSim
pnpm install
```

## 3) Environment

Create `.env` from `.env.example` and keep local values private:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 4) Start infrastructure

```bash
docker compose up -d postgres redis
```

## 5) Prisma + seed/reset

```bash
pnpm -C packages/db generate
pnpm -C packages/db migrate:deploy
pnpm sim:reset
```

## 6) Run services

Start each in its own terminal:

```bash
pnpm api:dev
pnpm worker:dev
pnpm web:dev
```

Default local URLs:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`

## 7) Verification gates

```bash
pnpm verify
```

Optional full stateful check (includes one worker tick run):

```bash
pnpm verify:full
```

## 8) Quick sanity checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/v1/world/health
```

## 9) Keep your working tree reproducible

Before switching machines, ensure changes are pushed:

```bash
git status -sb
git add -A
git commit -m "your message"
git push
```
