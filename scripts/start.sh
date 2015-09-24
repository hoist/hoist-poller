#!/usr/bin/env bash
set +e


echo "starting log hub"
bunyanhub start


#setup config
echo "setting up app config"
cp /config/production.json ./config/production.json
cp /config/docker.json ./config/docker.json

set -e
#start app
echo "starting app"
node app.js
