/* 今日訂餐資料讀取、即時計算與儲存控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

async function loadTodayMealOrder() {
  if (!isLoggedIn()) {
    return;
  }
  const loadSequence = ++mealOrderLoadSequence;
  mealOrderState = { ...mealOrderState, loading: true, error: "" };
  renderAll();
  try {
    const status = await window.schedulerApi.getTodayMealOrder();
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status, error: "" };
  } catch (error) {
    if (loadSequence !== mealOrderLoadSequence) return;
    mealOrderState = { loading: false, status: null, error: error.message || "讀取訂餐狀態失敗" };
  }
  renderAll();
}

function readMealOrderItems() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).map((input) => {
    const productId = input.dataset.mealProductId || "";
    const noteInput = document.querySelector(`[data-meal-note-product-id="${CSS.escape(productId)}"]`);
    return {
      productId,
      quantity: Number(input.value || 0),
      note: noteInput?.value || ""
    };
  });
}

function getMealOrderLiveSummary() {
  return Array.from(document.querySelectorAll("[data-meal-product-id]")).reduce((summary, input) => {
    const quantity = Math.max(0, Math.floor(Number(input.value || 0) || 0));
    const price = Number(input.dataset.mealProductPrice || 0) || 0;
    summary.quantity += quantity;
    summary.amount += quantity * price;
    return summary;
  }, { quantity: 0, amount: 0 });
}

function updateMealOrderLiveSummary() {
  const summaryElement = document.querySelector("[data-meal-live-summary]");
  if (!summaryElement) return;
  const summary = getMealOrderLiveSummary();
  summaryElement.textContent = `目前合計 ${summary.quantity} 份，$${summary.amount.toFixed(0)}`;
}

async function saveTodayMealOrder() {
  if (mealOrderState.loading) {
    return;
  }
  const items = readMealOrderItems();
  mealOrderState = { ...mealOrderState, loading: true, error: "" };
  renderAll();
  try {
    const status = await window.schedulerApi.saveTodayMealOrder({ items });
    mealOrderState = { loading: false, status, error: "" };
    showInfoMessage(items.some((item) => item.quantity > 0) ? "訂餐已儲存" : "今日訂餐已取消");
  } catch (error) {
    mealOrderState = { ...mealOrderState, loading: false, error: error.message || "儲存訂餐失敗" };
  }
  renderAll();
}
