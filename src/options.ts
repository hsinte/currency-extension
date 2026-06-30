import { API_URLS, i18n } from "./utils";

const currencyListSelect = document.getElementById(
  "currencylist",
) as HTMLSelectElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;

// 動態讀取台銀 CSV 並初始化下拉選單
async function iniDropDown() {
  try {
    const response = await fetch(API_URLS.CURRENT_DAY);
    const csvText = await response.text();
    const lines = csvText.split("\n");

    currencyListSelect.innerHTML = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.replace(/"/g, "").split(",");
      const currencyCode = columns[0] ? columns[0].trim() : "";

      if (/^[A-Z]{3}$/.test(currencyCode)) {
        const chineseName = i18n(currencyCode);
        currencyListSelect.add(
          new Option(`${chineseName} (${currencyCode})`, currencyCode),
        );
      }
    }

    // 關鍵修正：這裡改讀取 'defaultCurrency'
    chrome.storage.sync.get(["defaultCurrency"], (result) => {
      if (result && typeof result.defaultCurrency === "string") {
        currencyListSelect.value = result.defaultCurrency;
      } else {
        currencyListSelect.value = "JPY"; // 全空預設日圓
      }
    });
  } catch (error) {
    console.error("設定頁面載入外幣清單失敗:", error);
    currencyListSelect.innerHTML =
      '<option value="JPY">無法連線台銀伺服器</option>';
  }
}

// 儲存設定
function Save() {
  const selectedCurrency = currencyListSelect.value;

  // 關鍵修正：這裡改存入 'defaultCurrency'
  chrome.storage.sync.set({ defaultCurrency: selectedCurrency }, () => {
    window.close();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  iniDropDown();
  saveBtn.addEventListener("click", Save);
});
