import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
import {
  API_URLS,
  i18n,
  removeComma,
  STORAGE_KEYS,
  toCommaString,
} from "./utils";
import { checkAndNotify } from "./notifier";

// 1. 綁定 DOM 元素
const viewCurrencySelect = document.getElementById(
  "view-currency",
) as HTMLSelectElement;
const updateTimeSpan = document.getElementById(
  "update-time",
) as HTMLSpanElement;
const cashRateSpan = document.getElementById("cash-rate") as HTMLSpanElement;
const spotRateSpan = document.getElementById("spot-rate") as HTMLSpanElement;
const cashCard = document.getElementById("cash-card") as HTMLDivElement;
const spotCard = document.getElementById("spot-card") as HTMLDivElement;

const sourceAmountInput = document.getElementById(
  "source-amount",
) as HTMLInputElement;
const sourceSelect = document.getElementById(
  "source-currency",
) as HTMLSelectElement;
const targetAmountInput = document.getElementById(
  "target-amount",
) as HTMLInputElement;
const targetSelect = document.getElementById(
  "target-currency",
) as HTMLSelectElement;
const swapBtn = document.getElementById("btn-swap") as HTMLButtonElement;

const toggleChartBtn = document.getElementById(
  "btn-toggle-chart",
) as HTMLButtonElement;
const chartContainer = document.getElementById(
  "chart-container",
) as HTMLDivElement;

// 全域狀態管理
interface RateInfo {
  cashSell: number;
  spotSell: number;
}

// 基礎匯率庫：預設台幣 TWD 的匯率基準值為 1
let globalRates: Record<string, RateInfo> = {
  TWD: { cashSell: 1, spotSell: 1 },
};

let chartInstance: Chart | null = null;
let currentViewCurrency = "JPY"; // 當前牌告與趨勢圖查看的外幣
let configUseComma = false; // 儲存使用者是否開啟千分位的狀態
// 紀錄當前使用的是哪種匯率類型
// 'cashSell' 對應 CSV 的第 12/13 欄，'spotSell' 對應第 13/14 欄
let currentRateType: "cashSell" | "spotSell" = "cashSell";

// 2. 根據動態抓到的清單，生成下拉選單
function populateSelectOptions(fetchedCurrencies: string[]) {
  viewCurrencySelect.innerHTML = "";
  sourceSelect.innerHTML = "";
  targetSelect.innerHTML = "";

  // 永遠把 TWD 放在選單的最前面
  const fullList = ["TWD", ...fetchedCurrencies];

  fullList.forEach((cur) => {
    const chineseName = i18n(cur);

    // 最上方的「牌告看板」不需要顯示新台幣
    if (cur !== "TWD") {
      viewCurrencySelect.add(new Option(`${chineseName} (${cur})`, cur));
    }

    // 下方的雙向換算區包含所有幣別
    sourceSelect.add(new Option(`${chineseName} (${cur})`, cur));
    targetSelect.add(new Option(`${chineseName} (${cur})`, cur));
  });

  // 預設換算狀態：預設外幣(JPY) 換 台幣(TWD)
  sourceSelect.value = "JPY";
  targetSelect.value = "TWD";
}

// 解析 Response Header 中的更新時間
function parseUpdateTime(contentDisposition: string | null): string {
  if (!contentDisposition) return new Date().toLocaleTimeString();
  const match = contentDisposition.match(/@(\d{12})/);
  if (match && match[1]) {
    const str = match[1];
    return str.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5");
  }
  return new Date().toLocaleTimeString();
}

// 3. 核心：從台銀抓取當日最新 CSV 資料並「動態分析幣別」
async function fetchCurrentRates() {
  try {
    updateTimeSpan.textContent = "讀取中...";
    const response = await fetch(API_URLS.CURRENT_DAY);
    const csvText = await response.text();

    const header = response.headers.get("Content-Disposition");
    const updateTime = parseUpdateTime(header);

    const lines = csvText.split("\n");
    const fetchedCurrencies: string[] = []; // 用來存這一次動態抓到的外幣代碼

    // 從 i = 1 開始（跳過 CSV 的欄位標題）
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.replace(/"/g, "").split(",");
      const currencyCode = columns[0] ? columns[0].trim() : "";

      // 檢查：只要長度是 3 碼且是英文字母，就是合法的幣別代碼 (例如 USD, JPY)
      if (/^[A-Z]{3}$/.test(currencyCode)) {
        fetchedCurrencies.push(currencyCode);

        // 儲存對應的現金賣出與即期賣出
        globalRates[currencyCode] = {
          cashSell: parseFloat(columns[12]) || 0,
          spotSell: parseFloat(columns[13]) || 0,
        };
      }
    }

    // 動態渲染三個下拉選單！
    populateSelectOptions(fetchedCurrencies);

    // 從 Storage 讀取上次觀看的幣別紀錄
    chrome.storage.sync.get(
      [STORAGE_KEYS.DEFAULT_CURRENCY, STORAGE_KEYS.USE_COMMA],
      (result) => {
        configUseComma = !!result.useComma; // 快取千分位變數
        const defaultCurrency = result[STORAGE_KEYS.DEFAULT_CURRENCY] as
          | string
          | undefined;
        if (
          result &&
          typeof defaultCurrency === "string" &&
          globalRates[defaultCurrency]
        ) {
          currentViewCurrency = defaultCurrency;
        } else {
          currentViewCurrency = "JPY";
          chrome.storage.sync.set({ [STORAGE_KEYS.DEFAULT_CURRENCY]: "JPY" });
        }

        viewCurrencySelect.value = currentViewCurrency;

        // 依據當前看板幣別自動調整換算區
        syncExchangeSelectWithView();
        updateRateBoard(updateTime);

        // 預設填入 1 進行初始計算
        sourceAmountInput.value = "1";
        calculateRates("source");

        // 當使用者主動打開 Popup 查詢時，順便在前端做一次到價比對
        checkAndNotify(globalRates);
      },
    );
  } catch (error) {
    console.error("無法取得即時匯率:", error);
    updateTimeSpan.textContent = "連線失敗";
  }
}

// 更新上方的即時牌告看板
function updateRateBoard(timeStr?: string) {
  if (timeStr) updateTimeSpan.textContent = `更新：${timeStr}`;

  const cur = viewCurrencySelect.value;
  currentViewCurrency = cur;

  if (globalRates[cur]) {
    cashRateSpan.textContent = globalRates[cur].cashSell
      ? globalRates[cur].cashSell.toFixed(4)
      : "-";
    spotRateSpan.textContent = globalRates[cur].spotSell
      ? globalRates[cur].spotSell.toFixed(4)
      : "-";
  }
}

/**
 * 智慧型小數點四捨五入：根據金額大小動態決定保留幾位小數
 */
function smartToFixed(value: number): string {
  // 如果金額很小 (小於 100)，保留 4 位小數，這樣 1 日圓或 1 美金換算時才看得出即期/現金的差距
  if (value < 100) {
    return value.toFixed(4);
  }
  // 一般大額金額，保留 2 位小數即可
  return value.toFixed(2);
}

// 雙向即時換算邏輯
function calculateRates(direction: "source" | "target") {
  const srcCur = sourceSelect.value;
  const tgtCur = targetSelect.value;

  if (!globalRates[srcCur] || !globalRates[tgtCur]) return;

  // 依據 currentRateType 動態抓取匯率
  const srcRate = globalRates[srcCur][currentRateType];
  const tgtRate = globalRates[tgtCur][currentRateType];

  if (direction === "source") {
    // 先拔掉逗號再轉 Float
    const srcVal = parseFloat(removeComma(sourceAmountInput.value));
    if (isNaN(srcVal) || srcVal === 0) {
      targetAmountInput.value = "";
      return;
    }

    const tgtVal = (srcVal * srcRate) / tgtRate;
    const finalStr = smartToFixed(tgtVal);
    // 依據設定決定是否轉換成千分位
    targetAmountInput.value = configUseComma
      ? toCommaString(finalStr)
      : finalStr;
  } else {
    // 先拔掉逗號再轉 Float
    const tgtVal = parseFloat(removeComma(targetAmountInput.value));
    if (isNaN(tgtVal) || tgtVal === 0) {
      sourceAmountInput.value = "";
      return;
    }

    const srcVal = (tgtVal * tgtRate) / srcRate;
    const finalStr = smartToFixed(srcVal);
    // 依據設定決定是否轉換成千分位
    sourceAmountInput.value = configUseComma
      ? toCommaString(finalStr)
      : finalStr;
  }
}

// 抓取台銀近 30 天歷史資料並重繪圖表 (大寫 L3M)
async function fetchAndDrawChart() {
  if (currentViewCurrency === "TWD") return;

  try {
    const response = await fetch(
      `${API_URLS.HISTORY_L3M}${currentViewCurrency}`,
    );
    const csvText = await response.text();
    const lines = csvText.split("\n");

    const labels: string[] = [];
    const datas: number[] = [];
    // 決定要抓哪一欄：現金賣出在 columns[13]，即期賣出在 columns[14]
    const targetColumnIndex = currentRateType === "cashSell" ? 13 : 14;

    let fetchedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].replace(/"/g, "").split(",");
      const dateStr = columns[0];
      const rateVal = columns[targetColumnIndex]
        ? parseFloat(columns[targetColumnIndex].trim())
        : NaN;

      if (/^\d{8}$/.test(dateStr) && !isNaN(rateVal) && fetchedCount < 30) {
        labels.push(`${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`);
        datas.push(rateVal);
        fetchedCount++;
      }
    }

    labels.reverse();
    datas.reverse();

    const ctx = (
      document.getElementById("trend-chart") as HTMLCanvasElement
    ).getContext("2d");
    if (ctx) {
      if (chartInstance) chartInstance.destroy();

      chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "近30天匯率",
              data: datas,
              backgroundColor: "rgba(255, 99, 132, 0.05)",
              borderColor: "rgb(255, 99, 132)",
              borderWidth: 2,
              fill: true,
              pointRadius: 1,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
            y: { ticks: { precision: 4 } },
          },
        },
      });
    }
  } catch (error) {
    console.error("歷史圖表載入失敗:", error);
  }
}

// 連動輔助：當上方改變時，自動尋找下方「非 TWD 的那一欄」並同步
function syncExchangeSelectWithView() {
  const targetCur = viewCurrencySelect.value;
  if (sourceSelect.value !== "TWD") {
    sourceSelect.value = targetCur;
  } else if (targetSelect.value !== "TWD") {
    targetSelect.value = targetCur;
  } else {
    sourceSelect.value = targetCur;
  }
}

// 連動輔助：當下方外幣選單改變時，同步最上方看板
function syncViewWithExchangeSelect(changedSelect: HTMLSelectElement) {
  const newValue = changedSelect.value;
  if (newValue !== "TWD") {
    viewCurrencySelect.value = newValue;
    currentViewCurrency = newValue;

    updateRateBoard();
    if (!chartContainer.classList.contains("hidden")) {
      fetchAndDrawChart();
    }
  }
}

// 6. 事件註冊
viewCurrencySelect.addEventListener("change", () => {
  syncExchangeSelectWithView();
  updateRateBoard();
  calculateRates("source");

  if (!chartContainer.classList.contains("hidden")) {
    fetchAndDrawChart();
  }
});

sourceAmountInput.addEventListener("input", () => calculateRates("source"));
targetAmountInput.addEventListener("input", () => calculateRates("target"));

sourceSelect.addEventListener("change", () => {
  syncViewWithExchangeSelect(sourceSelect);
  calculateRates("source");
});

targetSelect.addEventListener("change", () => {
  syncViewWithExchangeSelect(targetSelect);
  calculateRates("source");
});

swapBtn.addEventListener("click", () => {
  const tempCur = sourceSelect.value;
  sourceSelect.value = targetSelect.value;
  targetSelect.value = tempCur;

  const tempAmt = sourceAmountInput.value;
  sourceAmountInput.value = targetAmountInput.value;
  targetAmountInput.value = tempAmt;

  calculateRates("source");
});

toggleChartBtn.addEventListener("click", () => {
  chartContainer.classList.toggle("hidden");
  if (!chartContainer.classList.contains("hidden")) {
    toggleChartBtn.textContent = "隱藏近 30 天趨勢圖";
    fetchAndDrawChart();
  } else {
    toggleChartBtn.textContent = "顯示近 30 天趨勢圖";
  }
});

// 點擊來源欄位時：移除逗號還原純數字，方便使用者編輯
sourceAmountInput.addEventListener("focus", () => {
  sourceAmountInput.value = removeComma(sourceAmountInput.value);
});

// 離開來源欄位時：如果開啟設定，重新補回千分位
sourceAmountInput.addEventListener("blur", () => {
  if (configUseComma && sourceAmountInput.value) {
    sourceAmountInput.value = toCommaString(sourceAmountInput.value);
  }
});

// 點擊目標欄位時：移除逗號還原純數字
targetAmountInput.addEventListener("focus", () => {
  targetAmountInput.value = removeComma(targetAmountInput.value);
});

// 離開目標欄位時：如果開啟設定，重新補回千分位
targetAmountInput.addEventListener("blur", () => {
  if (configUseComma && targetAmountInput.value) {
    targetAmountInput.value = toCommaString(targetAmountInput.value);
  }
});

// 點擊「現金賣出」牌卡
cashCard.addEventListener("click", () => {
  if (currentRateType === "cashSell") return; // 已在該模式則不動作
  currentRateType = "cashSell";

  // UI 狀態切換
  cashCard.classList.add("active");
  spotCard.classList.remove("active");

  // 重新計算並更新圖表
  calculateRates("source");
  if (!chartContainer.classList.contains("hidden")) fetchAndDrawChart();
});

// 點擊「即期賣出」牌卡
spotCard.addEventListener("click", () => {
  if (currentRateType === "spotSell") return;
  currentRateType = "spotSell";

  // UI 狀態切換
  spotCard.classList.add("active");
  cashCard.classList.remove("active");

  // 重新計算並更新圖表
  calculateRates("source");
  if (!chartContainer.classList.contains("hidden")) fetchAndDrawChart();
});

// 執行初始化
fetchCurrentRates();
