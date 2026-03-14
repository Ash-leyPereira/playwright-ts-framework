FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

COPY . .

RUN npm install

CMD ["npx","playwright","test"]