#!/bin/sh

# Default to running at midnight if no time is provided
RUN_AT="${RUN_AT:-0 0 * * *}"
CONFIG="${CONFIG:-'./configs'}"  # Corrected line

# Schedule the job and redirect stdout and stderr
echo "$RUN_AT cd /usr/src/app && node app.js $CONFIG > /proc/1/fd/1 2>/proc/1/fd/2" > /etc/crontabs/root

# Display the scheduled cron job for debugging
echo "Scheduled the following job:"
cat /etc/crontabs/root
echo "Current time: $(date)"

# Start crond in the foreground with debug level logging
crond -f -d 8
