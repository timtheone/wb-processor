# Use the official Bun image as a base
FROM oven/bun:1-debian as base
COPY --from=node:18 /usr/local/bin/node /usr/local/bin/node

# Set working directory in the Docker image
WORKDIR /usr/src/app

# Copy the entire monorepo
COPY . .

# Install dependencies at the monorepo root to respect workspaces
RUN bun install --frozen-lockfile

# Argument to specify service path
ARG PACKAGE_DIR

# You might want to run specific build commands for your backend or client here
# For example, if you need to generate Prisma client or run other build scripts:


# Final image setup
FROM base AS release
WORKDIR /usr/src/app/$PACKAGE_DIR
RUN if [ "$PACKAGE_DIR" = "packages/bot-client" ] ; then bunx prisma generate ; fi

# The entrypoint might need to be adjusted based on the specific service
ENTRYPOINT [ "bun", "start" ]
