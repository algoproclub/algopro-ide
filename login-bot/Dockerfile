FROM python:3.12-alpine
WORKDIR /app/login-bot

RUN apk add --no-cache chromium xvfb
COPY <<EOF /entry.sh
Xvfb :99 -ac -screen 0 1280x720x16 -nolisten tcp &
export DISPLAY=:99
python3 main.py
EOF

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./

ENTRYPOINT ["sh", "/entry.sh"]
