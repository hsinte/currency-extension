// 2. 網址集中管理常數 (集中管理，未來台銀若改網址只需改這裡)
export const API_URLS = {
  CURRENT_DAY: "https://rate.bot.com.tw/xrt/flcsv/0/day",
  HISTORY_L3M: "https://rate.bot.com.tw/xrt/flcsv/0/L3M/", // 後面動態接幣別，如 JPY
};

// 1. 共用 i18n 翻譯函數
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
