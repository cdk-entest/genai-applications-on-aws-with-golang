# syntax=docker/dockerfile:1

# Build the application from source
FROM golang:1.21.5 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /entest

# Run the tests in the container
FROM build-stage AS run-test-stage

# Deploy the application binary into a lean image
FROM gcr.io/distroless/base-debian11 AS build-release-stage

WORKDIR /

COPY --from=build-stage /entest /entest
COPY *.html ./
COPY static ./static

EXPOSE 3000

USER nonroot:nonroot

ENTRYPOINT ["/entest"]