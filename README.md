# Humanity Checkpoint

This project provides an interactive set of behavioral tests for distinguishing human visitors from bots. A Node.js server stores aggregated metrics for every completed session in a shared CSV file.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

The server serves the static frontend and appends all submitted session results to `data/all_user_data.csv`. Each run of the tests should end with the **«Завершить»** button, which sends the collected metrics to the server and shows a confirmation message once the CSV has been updated.

> **Где сохраняются данные?** Все сессии записываются в общий файл `data/all_user_data.csv`. Каталог `data/` создаётся автоматически при запуске сервера, а для удобства в репозитории лежит `data/README.md`, чтобы было легко найти место хранения.

## Data format

Every row in `data/all_user_data.csv` follows the structure:

```
UserID,TestType,StartTime,EndTime,Speed,Errors,Clicks,ScrollTime,Duration
```

Each test contributes one row that captures its timing, speed-related measurements, and interaction counts so the aggregated file can be used for further analysis.
