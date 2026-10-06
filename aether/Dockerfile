FROM node:20

# Install system dependencies for DuckDB and SQLite
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

# Create data directories
RUN mkdir -p data/parquet data/sqlite

EXPOSE 4000

CMD ["npm", "start"]
