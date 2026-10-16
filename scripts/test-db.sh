#!/usr/bin/env bash
# Starts/stops a throwaway local PostgreSQL cluster for tests on port 54329.
# Usage: scripts/test-db.sh start|stop
# Alternatively run `docker compose up -d db` and set TEST_DATABASE_URL yourself.
set -euo pipefail
PORT="${TEST_DB_PORT:-54329}"
DIR="${TEST_DB_DIR:-${TMPDIR:-/tmp}/zynk-test-pg}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/pg_ctl" ] || PGBIN="$(dirname "$(command -v pg_ctl)")"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

case "${1:-start}" in
  start)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      mkdir -p "$DIR"
      [ "$(id -u)" = "0" ] && chown postgres "$DIR"
      as_pg "$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
    fi
    if ! as_pg "$PGBIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
      as_pg "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR -c fsync=off -c synchronous_commit=off -c full_page_writes=off" -l "$DIR/log" -w start >/dev/null
    fi
    psql -h 127.0.0.1 -p "$PORT" -U postgres -tc "select 1 from pg_database where datname='zynk_test'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$PORT" -U postgres -c "create database zynk_test" >/dev/null
    echo "TEST_DATABASE_URL=postgres://postgres@127.0.0.1:$PORT/zynk_test"
    ;;
  stop)
    as_pg "$PGBIN/pg_ctl" -D "$DIR" -m fast stop >/dev/null 2>&1 || true
    echo "stopped"
    ;;
  *) echo "usage: $0 start|stop"; exit 1 ;;
esac
