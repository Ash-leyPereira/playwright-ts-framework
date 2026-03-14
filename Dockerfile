FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Java for Allure report generation
RUN apt-get update && \
    apt-get install -y default-jre && \
    rm -rf /var/lib/apt/lists/*

# Copy remaining project files
COPY . .

# Ensure reports directory exists
RUN mkdir -p reports

# Run Playwright tests
CMD ["sh","-c","npx playwright test && npx allure generate reports/allure-results --clean -o reports/allure-report"]