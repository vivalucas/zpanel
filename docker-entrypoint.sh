#!/bin/sh
set -eu

mkdir -p /app/conf /app/data

if [ ! -f /app/conf/conf.ini ]; then
  /app/zpanel -config
fi

chown -R zpanel:zpanel /app/conf /app/data

exec su-exec zpanel "$@"
