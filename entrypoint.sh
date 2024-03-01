#!/bin/bash
# Start the backend service in the background
cd /usr/src/app/packages/backend && bun start &

# Start the bot-client service in the foreground (or background, depending on your needs)
cd /usr/src/app/packages/bot-client && bun start

# If the second bun start should also run in the background, and you need the container to stay alive, you can use:
# cd /usr/src/app/packages/bot-client && bun start &
# wait -n

# Alternatively, if there's a specific way to keep the script running or to wait for both processes, adjust accordingly.
