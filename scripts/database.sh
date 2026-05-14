#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

verbose=0
filtered=()
for a in "$@"; do
  case "$a" in
    -v*)
      if [[ "$a" =~ ^-v+$ ]]; then
        n=$((${#a} - 1))
        ((n > 2)) && n=2
        ((n > verbose)) && verbose=$n
      else
        filtered+=("$a")
      fi
      ;;
    --verbose=*)
      n="${a#--verbose=}"
      if [[ "$n" =~ ^[0-9]+$ ]]; then
        ((n > 2)) && n=2
        ((n > verbose)) && verbose=$n
      else
        filtered+=("$a")
      fi
      ;;
    --verbose)
      ((verbose < 2)) && ((verbose++))
      ;;
    *)
      filtered+=("$a")
      ;;
  esac
done
set -- "${filtered[@]}"

usage() {
  local status="${1:-1}"
  echo "usage: scripts/database.sh [-v|-vv|--verbose[=N]] backup [prefix] | restore <prefix>" >&2
  exit "$status"
}

_run_print_argv() {
  if ((verbose >= 1)); then
    local shown="+"
    for x in "$@"; do shown+=" $(printf '%q' "$x")"; done
    echo "$shown" >&2
  fi
}

# Run a command; with -v/-vv echo argv, with -vv show live output, else capture stderr only so
# stdout still works in $(…) and pipes (callers may add >/dev/null when stdout is noise).
run() {
  _run_print_argv "$@"
  if ((verbose >= 2)); then
    "$@"
  else
    local elog
    elog=$(mktemp)
    if ! "$@" 2>"$elog"; then
      cat "$elog" >&2
      rm -f "$elog"
      return 1
    fi
    rm -f "$elog"
  fi
}

# Normalize user input to a bare backup prefix; exit 1 if invalid.
normalize_prefix() {
  local prefix="$1"
  prefix="${prefix#./backups/}"
  prefix="${prefix#backups/}"
  prefix="$(basename "$prefix")"
  prefix="${prefix%.mongo.archive}"
  prefix="${prefix%.redis.rdb}"
  if [[ -z "$prefix" ]]; then
    echo "invalid prefix" >&2
    exit 1
  fi
  case "$prefix" in
    *..* | */* | *\\*)
      echo "invalid prefix" >&2
      exit 1
      ;;
  esac
  echo "$prefix"
}

# Return 0 if the Redis service is running in AOF mode.
redis_uses_appendonly() {
  if [[ -n "$(run docker compose ps -q --status running redis 2>/dev/null)" ]]; then
    local v
    v=$(run docker compose exec -T redis redis-cli CONFIG GET appendonly 2>/dev/null | awk 'NR==2{gsub(/\r/,"");print;exit}') || return 1
    [[ "$v" == yes ]]
    return
  fi
  local cid cr
  cid=$(run docker compose ps -aq redis 2>/dev/null | head -1) || true
  if [[ -n "$cid" ]]; then
    cr=$(run docker inspect -f '{{json .Config.Cmd}}' "$cid" 2>/dev/null || echo '[]')
    [[ "$cr" == *appendonly* && "$cr" == *yes* ]]
    return
  fi
  local ans ans_lc
  echo "Could not infer whether this stack uses Redis AOF (no running or existing redis container)." >&2
  if [[ -r /dev/tty ]]; then
    read -r -p "Materialize AOF on disk after RDB restore (appendonly yes)? [y/N] " ans </dev/tty || true
  else
    read -r -p "Materialize AOF on disk after RDB restore (appendonly yes)? [y/N] " ans || true
  fi
  ans_lc=$(printf '%s' "${ans:-}" | tr '[:upper:]' '[:lower:]')
  case "$ans_lc" in
    y | yes) return 0 ;;
    *) return 1 ;;
  esac
}

# One-off redis loads dump.rdb with AOF off, then enables AOF to force a rebuild.
redis_rebuild_aof() {
  local rid i
  rid=$(run docker compose run -d --no-deps redis \
    redis-server \
    --appendonly no \
    --save 3600 1 \
    --save 300 100 \
    --save 60 10000) || true
  rid="${rid//$'\r'/}"
  rid="${rid// /}"
  if [[ -z "${rid//[$' \t\r\n']/}" ]]; then
    echo "redis restore: docker compose run failed (no container id)" >&2
    return 1
  fi

  for ((i = 0; i < 120; i++)); do
    if run docker exec "$rid" redis-cli ping 2>/dev/null | grep -q PONG; then
      break
    fi
    sleep 0.5
  done
  if ! run docker exec "$rid" redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "redis restore: one-off container did not respond to PING" >&2
    run docker rm -f "$rid" || true
    return 1
  fi

  run docker exec "$rid" redis-cli CONFIG SET appendonly yes
  run docker exec "$rid" redis-cli BGREWRITEAOF 2>/dev/null || true
  sleep "${REDIS_RESTORE_AOF_SETTLE_SECONDS:-4}"

  run docker exec "$rid" redis-cli SHUTDOWN SAVE 2>/dev/null || run docker stop "$rid" || true
  run docker rm -f "$rid" || true
}

restore_mongodb_from_prefix() {
  local prefix="$1"
  echo "Restoring MongoDB..."
  run docker compose run --rm --no-deps \
    -v "${ROOT}/backups:/backup:ro" \
    --entrypoint mongorestore \
    mongo \
    --uri=mongodb://mongo:27017 \
    --gzip \
    --drop \
    --quiet \
    --archive="/backup/${prefix}.mongo.archive"
}

restore_redis_volume_from_prefix() {
  local prefix="$1"
  echo "Restoring Redis data directory..."
  run docker compose run --rm --no-deps --user root \
    -v "${ROOT}/backups:/backup:ro" \
    --entrypoint /bin/sh \
    redis \
    -c "set -e; \
      rm -rf /data/appendonlydir /data/temp-appendonlydir; \
      rm -f /data/appendonly.aof /data/appendonly.aof.manifest /data/appendonly.aof.rdb; \
      cp /backup/${prefix}.redis.rdb /data/dump.rdb; \
      chown redis:redis /data/dump.rdb"
}

# True when the screeps service container exists and is in "running" state.
screeps_container_running() {
  [[ -n "$(run docker compose ps -q --status running screeps 2>/dev/null)" ]]
}

cmd_backup() {
  local PREFIX
  if [[ $# -gt 1 ]]; then
    usage 1
  fi
  if [[ $# -eq 1 ]]; then
    if [[ "$1" == -* ]]; then
      usage 1
    fi
    PREFIX=$(normalize_prefix "$1")
  else
    PREFIX=$(date +%Y%m%d-%H%M%S)
  fi

  local did_pause=false
  if screeps_container_running; then
    cleanup_resume_sim() {
      echo "Resuming simulation..."
      run docker compose exec screeps cli -c 'system.resumeSimulation();' || true
    }

    echo "Pausing simulation..."
    run docker compose exec screeps cli -c 'system.pauseSimulation();'
    did_pause=true

    trap cleanup_resume_sim EXIT

    local settle_sec="${BACKUP_SETTLE_SECONDS:-5}"
    echo "Waiting ${settle_sec}s for simulation to settle..."
    sleep "$settle_sec"
  else
    echo "Screeps container is not running; skipping pause/resume and backing up Mongo/Redis only."
  fi

  mkdir -p backups

  echo "Backing up MongoDB..."
  run docker compose run --rm --no-deps \
    -v "${ROOT}/backups:/backup" \
    --entrypoint mongodump \
    mongo \
    --uri=mongodb://mongo:27017 \
    --db=screeps \
    --gzip \
    --quiet \
    --archive="/backup/${PREFIX}.mongo.archive"

  echo "Backing up Redis..."
  run docker compose run --rm --no-deps \
    -v "${ROOT}/backups:/backup" \
    --entrypoint /bin/sh \
    redis \
    -c "exec redis-cli -h redis --rdb /backup/${PREFIX}.redis.rdb"

  if [[ "$did_pause" == true ]]; then
    trap - EXIT

    echo "Resuming simulation..."
    run docker compose exec screeps cli -c 'system.resumeSimulation();'
  fi

  echo "Backup finished: backups/${PREFIX}.mongo.archive and backups/${PREFIX}.redis.rdb"
}

cmd_restore() {
  if [[ $# -ne 1 ]] || [[ "$1" == -* ]]; then
    usage 1
  fi

  local prefix mongo_archive redis_rdb
  prefix=$(normalize_prefix "$1")

  mongo_archive="${ROOT}/backups/${prefix}.mongo.archive"
  redis_rdb="${ROOT}/backups/${prefix}.redis.rdb"

  if [[ ! -f "$mongo_archive" ]]; then
    echo "missing: $mongo_archive" >&2
    exit 1
  fi
  if [[ ! -f "$redis_rdb" ]]; then
    echo "missing: $redis_rdb" >&2
    exit 1
  fi

  echo "Restoring backup ${prefix}"

  run docker compose stop screeps

  restore_mongodb_from_prefix "$prefix"

  local want_aof=0
  if redis_uses_appendonly; then
    want_aof=1
    if ((verbose >= 1)); then
      echo "Redis server uses appendonly yes; will materialize AOF after RDB load." >&2
    fi
  fi

  run docker compose stop redis

  restore_redis_volume_from_prefix "$prefix"

  if ((want_aof)); then
    echo "Rebuilding Redis AOF from restored RDB..."
    redis_rebuild_aof
  else
    echo "Starting Redis..."
  fi
  run docker compose up -d --no-deps redis

  run docker compose start screeps

  echo "Restoring from backup ${prefix} complete"
}

case "${1:-}" in
  -h | --help)
    usage 0
    ;;
  backup)
    shift
    cmd_backup "$@"
    ;;
  restore)
    shift
    cmd_restore "$@"
    ;;
  *)
    usage 1
    ;;
esac
