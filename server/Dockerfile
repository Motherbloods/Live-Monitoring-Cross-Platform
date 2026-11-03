FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

RUN npx playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/* \
  && chmod -R a+rX /ms-playwright

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
