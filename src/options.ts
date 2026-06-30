import type { TrackItem } from "./utils";
import { API_URLS, i18n, STORAGE_KEYS } from "./utils";

// 原有元素
const currencyListSelect = document.getElementById(
  "currencylist",
) as HTMLSelectElement;
const enableCommaCheckbox = document.getElementById(
  "enable-comma",
) as HTMLInputElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;

// ✨ 新增通知功能對應的 DOM 元素
const trackCurrencySelect = document.getElementById(
  "track-currency",
) as HTMLSelectElement;
const trackTypeSelect = document.getElementById(
  "track-type",
) as HTMLSelectElement;
const trackConditionSelect = document.getElementById(
  "track-condition",
) as HTMLSelectElement;
const trackTargetInput = document.getElementById(
  "track-target",
) as HTMLInputElement;
const trackActionSelect = document.getElementById(
  "track-action",
) as HTMLSelectElement;
const addTrackBtn = document.getElementById(
  "add-track-btn",
) as HTMLButtonElement;
const trackListBody = document.getElementById(
  "track-list-body",
) as HTMLTableSectionElement;
const noTrackTip = document.getElementById(
  "no-track-tip",
) as HTMLParagraphElement;

let localTrackList: TrackItem[] = [];

// 初始化選單與資料
async function iniDropDown() {
  try {
    const response = await fetch(API_URLS.CURRENT_DAY);
    const csvText = await response.text();
    const lines = csvText.split("\n");

    currencyListSelect.innerHTML = "";
    trackCurrencySelect.innerHTML = ""; // 清空通知選單

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.replace(/"/g, "").split(",");
      const currencyCode = columns[0] ? columns[0].trim() : "";

      if (/^[A-Z]{3}$/.test(currencyCode)) {
        const chineseName = i18n(currencyCode);
        const optionText = `${chineseName} (${currencyCode})`;

        // 填入預設幣別下拉選單
        currencyListSelect.add(new Option(optionText, currencyCode));
        // 填入通知幣別下拉選單
        trackCurrencySelect.add(new Option(optionText, currencyCode));
      }
    }

    // 讀取 Chrome 儲存的所有設定
    chrome.storage.sync.get(
      [
        STORAGE_KEYS.DEFAULT_CURRENCY,
        STORAGE_KEYS.USE_COMMA,
        STORAGE_KEYS.TRACK_LIST,
      ],
      (result) => {
        const defaultCurrency = result[STORAGE_KEYS.DEFAULT_CURRENCY] as
          | string
          | undefined;

        if (defaultCurrency && typeof defaultCurrency === "string") {
          currencyListSelect.value = defaultCurrency;
        } else {
          currencyListSelect.value = "JPY";
        }

        enableCommaCheckbox.checked = !!result[STORAGE_KEYS.USE_COMMA];

        // 快取並渲染追蹤清單
        localTrackList = (result[STORAGE_KEYS.TRACK_LIST] || []) as TrackItem[];
        renderTrackList();
      },
    );
  } catch (error) {
    console.error("設定頁面初始化失敗:", error);
  }
}

// ✨ 渲染追蹤清單表格
function renderTrackList() {
  trackListBody.innerHTML = "";

  if (localTrackList.length === 0) {
    noTrackTip.classList.remove("hidden");
    return;
  }
  noTrackTip.classList.add("hidden");

  localTrackList.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 transition";

    const typeText = item.rateType === "cashSell" ? "現金賣出" : "即期賣出";
    const condText = item.condition === "lte" ? "≤ 低於等於" : "≥ 高於等於";
    const actionText =
      item.action === "pause"
        ? "通知後暫停"
        : item.action === "delete"
          ? "通知後刪除"
          : "持續通知";

    // 狀態標籤樣式
    const statusBadge =
      item.status === "active"
        ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">進行中</span>'
        : '<span class="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium cursor-pointer hover:bg-amber-200 toggle-status-btn" title="點選重啟">已暫停 🔄</span>';

    tr.innerHTML = `
      <td class="p-3 font-semibold text-gray-900">${i18n(item.code)} (${item.code})</td>
      <td class="p-3 text-gray-600">${typeText}</td>
      <td class="p-3 text-blue-600 font-medium">${condText}</td>
      <td class="p-3 font-mono font-bold">${item.targetPrice}</td>
      <td class="p-3 text-xs text-gray-500">${actionText}</td>
      <td class="p-3" data-id="${item.id}">${statusBadge}</td>
      <td class="p-3 text-center">
        <button class="text-red-500 hover:text-red-700 font-medium delete-track-btn" data-id="${item.id}">刪除</button>
      </td>
    `;

    // 綁定「重啟已暫停項目」的小功能
    const toggleBtn = tr.querySelector(".toggle-status-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        item.status = "active";
        saveTrackListToStorage();
      });
    }

    // 綁定「刪除」按鈕事件
    const deleteBtn = tr.querySelector(
      ".delete-track-btn",
    ) as HTMLButtonElement;
    deleteBtn.addEventListener("click", () => {
      localTrackList = localTrackList.filter((t) => t.id !== item.id);
      saveTrackListToStorage();
    });

    trackListBody.appendChild(tr);
  });
}

// ✨ 新增追蹤項目事件（含重複防禦）
function addTrackItem() {
  const code = trackCurrencySelect.value;
  const rateType = trackTypeSelect.value as "cashSell" | "spotSell";
  const condition = trackConditionSelect.value as "lte" | "gte";
  const targetPrice = parseFloat(trackTargetInput.value.trim());

  if (isNaN(targetPrice) || targetPrice <= 0) {
    alert("請輸入有效的目標價格數字！");
    return;
  }

  // 💡 關鍵防禦：嚴格防重複追蹤 (同一幣別、同一類別、同一條件算重複)
  const isDuplicate = localTrackList.some(
    (item) =>
      item.code === code &&
      item.rateType === rateType &&
      item.condition === condition,
  );

  if (isDuplicate) {
    alert(
      `此幣別的【${rateType === "cashSell" ? "現金賣出" : "即期賣出"}】已存在相同的觸發條件，請勿重複新增！`,
    );
    return;
  }

  const newItem: TrackItem = {
    id: Date.now().toString(), // 用當前時間戳記做不重複 ID
    code,
    rateType,
    condition,
    targetPrice,
    action: trackActionSelect.value as "pause" | "delete" | "continue",
    status: "active",
  };

  localTrackList.push(newItem);
  saveTrackListToStorage();

  // 清空輸入框
  trackTargetInput.value = "";
}

// ✨ 統一將最新清單狀態存入 Storage 並重繪
function saveTrackListToStorage() {
  chrome.storage.sync.set({ [STORAGE_KEYS.TRACK_LIST]: localTrackList }, () => {
    renderTrackList();
  });
}

// 原有儲存主要設定功能
function SaveMainConfig() {
  chrome.storage.sync.set(
    {
      [STORAGE_KEYS.DEFAULT_CURRENCY]: currencyListSelect.value,
      [STORAGE_KEYS.USE_COMMA]: enableCommaCheckbox.checked,
    },
    () => {
      window.close();
    },
  );
}

document.addEventListener("DOMContentLoaded", () => {
  iniDropDown();
  saveBtn.addEventListener("click", SaveMainConfig);
  addTrackBtn.addEventListener("click", addTrackItem); // 註冊新增事件
});
