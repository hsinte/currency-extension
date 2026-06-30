// 網址集中管理常數 (集中管理，未來台銀若改網址只需改這裡)
export const API_URLS = {
  CURRENT_DAY: "https://rate.bot.com.tw/xrt/flcsv/0/day",
  HISTORY_L3M: "https://rate.bot.com.tw/xrt/flcsv/0/L3M/", // 後面動態接幣別，如 JPY
};

// 共用 i18n 翻譯函數
export function i18n(currency: string): string {
  const dictionary: Record<string, string> = {
    TWD: "新台幣",
    USD: "美金",
    HKD: "港幣",
    GBP: "英鎊",
    AUD: "澳幣",
    CAD: "加拿大幣",
    SGD: "新加坡幣",
    CHF: "瑞士法郎",
    JPY: "日圓",
    ZAR: "南非幣",
    SEK: "瑞典幣",
    NZD: "紐元",
    THB: "泰幣",
    PHP: "菲國比索",
    IDR: "印尼幣",
    EUR: "歐元",
    KRW: "韓元",
    VND: "越南盾",
    MYR: "馬來幣",
    CNY: "人民幣",
  };
  return dictionary[currency] || currency;
}

/**
 * 將純數字字串轉為千分位格式 (例如 "1234.56" -> "1,234.56")
 */
export function toCommaString(valStr: string): string {
  if (!valStr) return "";
  const parts = valStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * 將帶有千分位的字串還原為純數字字串 (例如 "1,234.56" -> "1234.56")
 */
export function removeComma(valStr: string): string {
  return valStr.replace(/,/g, "");
}

export interface TrackItem {
  id: string; // 唯一的防打架 ID (可用時間戳記)
  code: string; // 幣別代碼, 如 "JPY"
  rateType: "cashSell" | "spotSell"; // 匯率類別
  condition: "lte" | "gte"; // lte: 小於等於, gte: 大於等於
  targetPrice: number; // 目標價格
  action: "pause" | "delete" | "continue"; // 達成後的動作
  status: "active" | "paused"; // 當前這條追蹤是否啟動中
}

// 統一管理儲存的 Key 名稱
export const STORAGE_KEYS = {
  DEFAULT_CURRENCY: "defaultCurrency",
  USE_COMMA: "useComma",
  TRACK_LIST: "trackList", // 儲存 [TrackItem, TrackItem, ...]
};
