#!/usr/bin/env bash
set +e

#setup config
echo "setting up app config"
cp /config/production.json ./config/production.json

set -e
#start app
echo "starting app"
node app.js
