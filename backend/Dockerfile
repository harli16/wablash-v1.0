#FROM ghcr.io/puppeteer/puppeteer:latest

# Pakai direktori kerja
#WORKDIR /app

# ⬇️ Salin file package.json dan berikan permission ke pptruser saat copy
#COPY --chown=pptruser:pptruser package*.json ./

# Ganti ke user pptruser
#USER pptruser

# Jalankan npm install sebagai pptruser
#RUN npm install

# ⬇️ Salin seluruh isi project (jangan ubah ownership karena sudah pptruser)
#COPY --chown=pptruser:pptruser . .

# Jalankan aplikasi
#CMD ["node", "index.js"]


#FROM ghcr.io/puppeteer/puppeteer:latest

# Pindah ke direktori kerja
#WORKDIR /app

# Salin file package.json dengan hak milik user pptruser
#COPY --chown=pptruser:pptruser package*.json ./

# Ganti user ke pptruser
#USER pptruser

# Install dependency
#RUN npm install

# Salin semua isi project ke dalam image
#COPY --chown=pptruser:pptruser . .

# Jalankan aplikasi
#CMD ["node", "index.js"]


FROM browserless/chrome:latest

USER root

# Pasang Node.js secara manual (karena image ini hanya punya Chrome)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    node -v && npm -v

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
