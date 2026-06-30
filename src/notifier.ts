import type { TrackItem } from "./utils";
import { STORAGE_KEYS, i18n } from "./utils";

/**
 * 核心比對引擎：傳入最新匯率表，自動對比清單並決定是否發送通知
 */
export function checkAndNotify(
  globalRates: Record<string, { cashSell: number; spotSell: number }>,
) {
  chrome.storage.sync.get([STORAGE_KEYS.TRACK_LIST], (result) => {
    let list = (result[STORAGE_KEYS.TRACK_LIST] || []) as TrackItem[];
    let isListChanged = false;

    list.forEach((item) => {
      // 如果已經被暫停，就不做比對
      if (item.status === "paused") return;

      const rateInfo = globalRates[item.code];
      if (!rateInfo) return;

      const currentPrice = rateInfo[item.rateType];
      let isTriggered = false;

      // 比對條件判定
      if (item.condition === "lte" && currentPrice <= item.targetPrice) {
        isTriggered = true;
      } else if (item.condition === "gte" && currentPrice >= item.targetPrice) {
        isTriggered = true;
      }

      // 條件成立，觸發轟炸與後續處理機制
      if (isTriggered) {
        triggerChromeNotification(item, currentPrice);

        // 判定達成後的處理
        if (item.action === "pause") {
          item.status = "paused";
          isListChanged = true;
        } else if (item.action === "delete") {
          list = list.filter((t) => t.id !== item.id);
          isListChanged = true;
        }
        // 如果是 'continue'，就不動它，下次檢查會繼續通知
      }
    });

    // 如果有追蹤項目的狀態被更新或刪除，同步回儲存區
    if (isListChanged) {
      chrome.storage.sync.set({ [STORAGE_KEYS.TRACK_LIST]: list });
    }
  });
}

/**
 * 呼叫瀏覽器原生通知視窗
 */
function triggerChromeNotification(item: TrackItem, currentPrice: number) {
  const typeName = item.rateType === "cashSell" ? "現金賣出" : "即期賣出";
  const condName = item.condition === "lte" ? "低於或等於" : "高於或等於";

  chrome.notifications.create(item.id, {
    type: "basic",
    iconUrl: "icons/icon.png", // 通知欄左側的小圖示
    title: `🔔 匯率到價特報！`,
    message: `${i18n(item.code)} (${item.code}) 的 ${typeName} 目前為 ${currentPrice}，已符合您設定的「${condName} ${item.targetPrice}」條件！`,
    priority: 2,
  });
}
