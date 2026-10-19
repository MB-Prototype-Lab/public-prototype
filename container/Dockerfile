# Build context: container/ only. Runtime source arrives through read-only mounts.
FROM node:22.23.3-bookworm-slim@sha256:efd0ab5780c2d9ab1f0f869571a00d5edb17793bff4cce4a2792e3eb0ffc7562 AS node
FROM python:3.12.15-slim-bookworm@sha256:2ed6491b93cd49272ee6de2b5a38440c3448360322c089fc23e370722d74179d AS toolchain
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/moneybuddy/browsers \
    MB_PLAYWRIGHT_MODULE=/opt/moneybuddy/browser/node_modules/playwright
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && rm -f /etc/apt/sources.list.d/* \
 && printf '%s\n' \
 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20261018T000000Z bookworm main' \
 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20261018T000000Z bookworm-security main' > /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends bash ca-certificates curl coreutils findutils grep sed gawk \
    diffutils tar xz-utils unzip procps libcurl4 libexpat1 gettext-base \
    build-essential libcurl4-openssl-dev libexpat1-dev libssl-dev zlib1g-dev gettext \
 && curl --fail --location https://www.kernel.org/pub/software/scm/git/git-2.49.0.tar.xz -o /tmp/git.tar.xz \
 && echo '618190cf590b7e9f6c11f91f23b1d267cd98c3ab33b850416d8758f8b5a85628  /tmp/git.tar.xz' | sha256sum -c - \
 && tar -xJf /tmp/git.tar.xz -C /tmp \
 && make -C /tmp/git-2.49.0 -j2 prefix=/usr/local NO_TCLTK=YesPlease all \
 && make -C /tmp/git-2.49.0 prefix=/usr/local NO_TCLTK=YesPlease install \
 && rm -rf /tmp/git* \
 && apt-get purge -y build-essential gcc g++ make libcurl4-openssl-dev libexpat1-dev libssl-dev zlib1g-dev gettext \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/moneybuddy/browser
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && apt-get update \
 && npx playwright install --with-deps chromium \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt /opt/moneybuddy/requirements.txt
RUN python3 -m pip install --no-cache-dir --require-hashes --only-binary=:all: -r /opt/moneybuddy/requirements.txt
COPY runner.py ci.sh validate-skill.py /opt/moneybuddy/
ENV MB_CONTAINER=1
RUN mkdir -p /work && chmod 1777 /work
WORKDIR /work
ENTRYPOINT ["python3", "/opt/moneybuddy/runner.py"]
CMD ["doctor"]
