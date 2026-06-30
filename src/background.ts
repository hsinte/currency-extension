import { API_URLS } from "./utils";
import { checkAndNotify } from "./notifier";

// 當擴充功能安裝或瀏覽器重啟時，註冊定時鬧鐘
chrome.runtime.onInstalled.addListener(() => {
  // 建立一個叫 'fetch-rate-alarm' 的定時器，每 60 分鐘跑一次
  chrome.alarms.create("fetch-rate-alarm", {
    periodInMinutes: 60,
  });
  console.log("匯率背景監聽鬧鐘已註冊成功！");
});

// 監聽鬧鐘觸發事件
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetch-rate-alarm") {
    fetchLatestRatesAndCheck();
  }
});

/**
 * 背景默默抓取台銀當日 CSV 的核心函式
 */
async function fetchLatestRatesAndCheck() {
  try {
    const response = await fetch(API_URLS.CURRENT_DAY);
    const csvText = await response.text();
    const lines = csvText.split("\n");

    const rates: Record<string, { cashSell: number; spotSell: number }> = {
      TWD: { cashSell: 1, spotSell: 1 },
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.replace(/"/g, "").split(",");
      const currencyCode = columns[0] ? columns[0].trim() : "";

      if (/^[A-Z]{3}$/.test(currencyCode)) {
        // 抓取現鈔賣出 (Index 13) 與 即期賣出 (Index 14)
        const cashSell = columns[13] ? parseFloat(columns[13].trim()) : NaN;
        const spotSell = columns[14] ? parseFloat(columns[14].trim()) : NaN;

        if (!isNaN(cashSell) || !isNaN(spotSell)) {
          rates[currencyCode] = {
            cashSell: isNaN(cashSell) ? spotSell : cashSell,
            spotSell: isNaN(spotSell) ? cashSell : spotSell,
          };
        }
      }
    }

    // 丟給 notifier 引擎去比對追蹤清單
    checkAndNotify(rates);
  } catch (error) {
    console.error("背景抓取最新匯率失敗:", error);
  }
}
