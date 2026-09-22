#!/usr/bin/env bash
# INTERPOL BOT • Скрипт запуска для Linux / Ubuntu VPS
cd "$(dirname "$0")" || exit 1
node start.js "$@"
