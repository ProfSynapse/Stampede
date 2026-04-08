# stampede/Dockerfile
# Lean Alpine-based k6 image for running Stampede load tests.
# Railway-compatible: runs as a one-off worker (no PORT listening).

FROM alpine:3.21

# Pin k6 version for reproducible builds.
ARG K6_VERSION=0.55.0

RUN apk add --no-cache curl bash \
    && curl -sL "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-amd64.tar.gz" \
       | tar xz \
    && mv "k6-v${K6_VERSION}-linux-amd64/k6" /usr/local/bin/ \
    && rm -rf "k6-v${K6_VERSION}-linux-amd64" \
    && apk del curl

WORKDIR /stampede

# Copy all Stampede files.
COPY . .

# Make entrypoint executable.
RUN chmod +x run.sh

ENTRYPOINT ["/stampede/run.sh"]
