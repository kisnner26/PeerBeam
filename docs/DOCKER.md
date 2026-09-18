# Docker development workflow

This is a development-only Compose setup. It does not build a production
image, configure a public deployment, add TURN, or add file storage. The
native workflow (`npm ci` + `npm run dev`, see the root [README](../README.md))
keeps working unchanged and is still the first-class way to run PeerBeam.

Use this instead when you want to avoid installing Node locally, or when
you are specifically checking how PeerBeam behaves from inside a
container-first network setup.

## Prerequisites

- Docker Engine with the Compose plugin (`docker compose version`).

## Start

From the repository root:

```sh
docker compose up
```

This builds the shared development image on first run, then starts both
services:

- Web app: <http://localhost:5173>
- Signaling: `ws://127.0.0.1:8080`

Those are the same default ports the native workflow uses. Open the web URL
in two browser tabs (or two browsers) to create a session in one and join it
from the other, the same way you would with the native workflow.

The first start installs dependencies into a Docker-managed volume, which
takes a bit longer than later starts. Dependencies are re-installed
automatically only when that volume is empty (first run, or after
`docker compose down -v`), so an ordinary `docker compose up` afterward skips
straight to starting both services.

## Live source

The repository is bind-mounted into both containers, so edits to `apps/`,
`packages/`, or anything else in the repo are picked up the same way they are
with the native workflow: Vite HMR for `apps/web`, and `tsx watch` restarting
`apps/signaling-server` on change.

`node_modules` is intentionally excluded from that mount (each service keeps
its own Docker-managed volume for it) so container-installed dependencies are
never shadowed by whatever exists, or does not exist, on the host.

## Stop

```sh
docker compose down
```

Add `-v` to also remove the `node_modules` volumes, forcing a clean
reinstall on the next `docker compose up`:

```sh
docker compose down -v
```

## Logs

```sh
docker compose logs -f            # both services
docker compose logs -f web        # just the web app
docker compose logs -f signaling  # just the signaling server
```

## Environment overrides

Both services read the same optional root `.env` the native workflow uses
(copy `.env.example` to `.env` to customize `PORT`, `VITE_PORT`,
`ALLOWED_ORIGINS`, `VITE_SIGNALING_URL`, `VITE_STUN_URL`, or the session TTLs
— see the root README). Compose also uses that file to keep the containers'
published ports in sync with whatever `PORT` / `VITE_PORT` you set.

One exception: `HOST` is always forced to `0.0.0.0` inside the `signaling`
container regardless of `.env`, since the app's own default (`127.0.0.1`)
would only accept connections from inside its own container. This is set in
`docker-compose.yml`, not in `.env` — there's nothing to configure here.

To override a value for a single run without editing `.env`:

```sh
PORT=9090 docker compose up
```
