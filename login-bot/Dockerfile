FROM python:3.12-alpine
WORKDIR /app/login-bot

RUN apk add --no-cache chromium xvfb git
COPY <<EOF /entry.sh
rm -f /tmp/.X99-lock
(
    while true; do
        echo "Starting Xvfb"
        Xvfb :99 -ac -screen 0 1280x720x16 -nolisten tcp
    done
) &
export DISPLAY=:99
(
    while true; do
        echo "Starting chromium"
        chromium \\
            --remote-allow-origins=* \\
            --no-first-run \\
            --no-service-autorun \\
            --no-default-browser-check \\
            --homepage=about:blank \\
            --no-pings \\
            --password-store=basic \\
            --disable-infobars \\
            --disable-breakpad \\
            --disable-component-update \\
            --disable-backgrounding-occluded-windows \\
            --disable-renderer-backgrounding \\
            --disable-background-networking \\
            --disable-dev-shm-usage \\
            --disable-features=IsolateOrigins,site-per-process \\
            --disable-session-crashed-bubble \\
            --disable-search-engine-choice-screen \\
            --user-data-dir=/tmp/uc_ydffr0_z \\
            --disable-features=IsolateOrigins,site-per-process \\
            --disable-session-crashed-bubble \\
            --no-sandbox \\
            --remote-debugging-host=127.0.0.1 \\
            --remote-debugging-port=55555
    done
) &
python3 main.py
EOF

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./

ENTRYPOINT ["sh", "/entry.sh"]
