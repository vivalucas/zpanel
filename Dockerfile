FROM node:24.15.0-alpine AS web_image

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

WORKDIR /build

COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml /build/

RUN pnpm install --frozen-lockfile

COPY . /build

RUN pnpm run build

FROM golang:1.26.3-alpine AS server_image

WORKDIR /build

RUN apk add --no-cache curl gcc git musl-dev

COPY ./service/go.mod ./service/go.sum ./

RUN go mod download

COPY ./service .

RUN go env -w GO111MODULE=on \
    && CGO_CFLAGS="-D_LARGEFILE64_SOURCE" go build -o zpanel --ldflags="-X zpanel/global.RUNCODE=release -X zpanel/global.ISDOCKER=docker" main.go



FROM alpine:3.22

WORKDIR /app

COPY --from=web_image /build/dist /app/web

COPY --from=server_image /build/zpanel /app/zpanel

EXPOSE 6521

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S zpanel \
    && adduser -S -G zpanel -u 1000 zpanel \
    && chmod +x ./zpanel \
    && ./zpanel -config \
    && chown -R zpanel:zpanel /app

USER zpanel

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6521/api/healthz >/dev/null || exit 1

CMD ["./zpanel"]
