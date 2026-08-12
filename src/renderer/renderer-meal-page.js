/* 今日訂餐資料讀取、即時計算與儲存控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

const MEAL_QUANTITY_ERROR = "訂餐數量只能輸入 0 或正整數";
const MEAL_SUBSIDY_ERROR = "公司補助只能輸入正整數";

function isMealQuantityInput(target) {
    return target instanceof HTMLInputElement && Boolean(target.dataset.mealProductId);
  }

function isCompanySubsidyInput(target) {
    return target instanceof HTMLInputElement && target.dataset.mealCompanySubsidy !== undefined;
  }

function rejectInput(input, event, message) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    input.setCustomValidity(message);
    input.reportValidity();
  }

function rejectQuantityInput(input, event) {
    rejectInput(input, event, MEAL_QUANTITY_ERROR);
  }

function validateMealOrderItems(items) {
    const products = mealOrderState.status?.products || [];
    const oldOrders = mealOrderState.status?.orders || [];
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isInteger(item.quantity)) {
        throw new Error("訂餐數量必須是 0 或正整數");
      }
      const product = products.find((row) => row.id === item.productId);
      const oldOrder = oldOrders.find((row) => row.product_id === item.productId);
      if (product?.is_active === false && item.quantity > Number(oldOrder?.quantity || 0)) {
        throw new Error("停用品項只能減少或取消，不可增加數量");
      }
    }
  }

function applyMealInputLimits() {
    const products = mealOrderState.status?.products || [];
    const orders = mealOrderState.status?.orders || [];
    document.querySelectorAll("[data-meal-product-id]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.dataset.lastValidMealQuantity = /^\d+$/.test(input.value) ? input.value : "0";
      input.setCustomValidity("");

      const product = products.find((row) => row.id === input.dataset.mealProductId);
      const oldOrder = orders.find((row) => row.product_id === input.dataset.mealProductId);
      if (product?.is_active === false) {
        input.max = String(Number(oldOrder?.quantity || 0));
        input.title = `停用品項最多保留原訂數量 ${Number(oldOrder?.quantity || 0)}`;
      }
    });
  }

function syncCurrentGroupMealAvailability(status) {
  if (typeof status?.mealEnabled !== "boolean") return;
  const actorGroup = getActorGroup();
  if (actorGroup) actorGroup.mealEnabled = status.mealEnabled;
}

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
    syncCurrentGroupMealAvailability(status);
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
    if (mealOrderState.loading) return;
    const items = readMealOrderItems();
    try {
      validateMealOrderItems(items);
    } catch (error) {
      mealOrderState = { ...mealOrderState, error: error.message || "訂餐資料錯誤" };
      renderAll();
      return;
    }

    const hadOrder = (mealOrderState.status?.orders || []).length > 0;
    const cancelling = hadOrder && !items.some((item) => item.quantity > 0);
    if (cancelling) {
      const confirmed = await confirmAction("所有品項都是 0，確定要取消今日整張訂單嗎？");
      if (!confirmed) return;
    }

    // 儲存期間重新渲染時沿用本次輸入，避免成功提示出現前欄位跳回舊值。
    mealOrderState = { ...mealOrderState, loading: true, error: "", pendingItems: items };
    renderAll();
    try {
      const status = await window.schedulerApi.saveTodayMealOrder({ items });
      syncCurrentGroupMealAvailability(status);
      mealOrderState = { loading: false, status, error: "", pendingItems: null };
      showInfoMessage(cancelling ? "今日訂餐已取消" : "訂餐已儲存");
    } catch (error) {
      mealOrderState = { ...mealOrderState, loading: false, error: error.message || "儲存訂餐失敗" };
    }
    renderAll();
  }
