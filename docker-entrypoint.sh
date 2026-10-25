#!/bin/sh
set -eu

mkdir -p /app/conf /app/data /app/lang

if [ ! -f /app/conf/conf.ini ]; then
  /app/zpanel -config
fi

chown -R zpanel:zpanel /app/conf /app/data /app/lang

# su-exec resets supplementary groups from /etc/group. Preserve only the
# mounted Docker socket group when the container was started with that group.
prepare_docker_socket_group() (
  [ -S /var/run/docker.sock ] || return 0
  docker_socket_gid=$(stat -c '%g' /var/run/docker.sock) || return 1
  case "$docker_socket_gid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$docker_socket_gid" -le 4294967294 ] || return 1
  docker_start_groups=$(id -G) || return 1
  case " $docker_start_groups " in
    *" $docker_socket_gid "*)
      docker_user_groups=$(id -G zpanel) || return 1
      case " $docker_user_groups " in
        *" $docker_socket_gid "*) ;;
        *)
          docker_socket_group=$(awk -F: -v gid="$docker_socket_gid" '$3 == gid { print $1; exit }' /etc/group) || return 1
          if [ -z "$docker_socket_group" ]; then
            docker_socket_group="zpanel-docker-$docker_socket_gid"
            docker_group_suffix=0
            while :; do
              docker_group_exists=$(awk -F: -v name="$docker_socket_group" '$1 == name { print 1; exit }' /etc/group) || return 1
              [ "$docker_group_exists" = 1 ] || break
              docker_group_suffix=$((docker_group_suffix + 1))
              docker_socket_group="zpanel-docker-$docker_socket_gid-$docker_group_suffix"
            done
            # BusyBox addgroup -g rejects IDs above its configured LAST_ID.
            # The validated Linux GID and generated name are safe group fields.
            printf '%s:x:%s:\n' "$docker_socket_group" "$docker_socket_gid" >> /etc/group || return 1
          fi
          addgroup zpanel "$docker_socket_group" || return 1
          ;;
      esac
      ;;
  esac
)

if ! prepare_docker_socket_group; then
  printf '%s\n' 'ZPanel: warning: could not prepare the Docker socket group; continuing startup.' >&2
fi

exec su-exec zpanel "$@"
