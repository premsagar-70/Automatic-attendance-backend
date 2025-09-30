# Server - Smart Attendance System

## Setup

1. Install dependencies

```powershell
cd server
npm install
```

2. Create `.env` from `.env.example` and update values

3. Run server (development)

```powershell
npm run dev
```

4. Run smoke tests

```powershell
node scripts/smokeTest.js
```

## Docker

Build and run via docker-compose:

```powershell
docker-compose up --build
```
