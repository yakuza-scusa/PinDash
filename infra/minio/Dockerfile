FROM golang:1.24-alpine AS builder

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ARG MC_VERSION=RELEASE.2025-08-13T08-35-41Z

RUN apk add --no-cache git
RUN git clone --depth 1 --branch "${MINIO_VERSION}" https://github.com/minio/minio.git /src/minio
RUN git clone --depth 1 --branch "${MC_VERSION}" https://github.com/minio/mc.git /src/mc
RUN cd /src/minio && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/minio .
RUN cd /src/mc && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mc .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget \
    && addgroup -S minio \
    && adduser -S -G minio minio \
    && mkdir -p /data \
    && chown minio:minio /data

COPY --from=builder /out/minio /usr/local/bin/minio
COPY --from=builder /out/mc /usr/local/bin/mc

USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
