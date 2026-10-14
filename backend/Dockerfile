FROM python:3.11-slim

# opencv needs these system libs even in "headless" mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data /app/snapshots

EXPOSE 8000

# NOTE: --workers 1 is required, not a default left as-is. The detection
# engine, its in-memory track/temporal state, and the WebSocket manager
# all live in-process; running multiple uvicorn workers would give each
# worker its OWN camera handle and its OWN alert state, which both breaks
# correctness (duplicate/missed alerts) and likely fails outright if only
# one process can open the camera device. Scale by running more cameras
# as separate container instances, not by adding workers to this one.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
