(function installV2MealUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;

  const originalRenderMealPage = renderMealPage;
  const quantityError = "訂餐數量只能輸入 0 或正整數";

  function isMealQuantityInput(target) {
    return target instanceof HTMLInputElement && Boolean(target.dataset.mealProductId);
  }

  function rejectQuantityInput(input, event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    input.setCustomValidity(quantityError);
    input.reportValidity();
  }

  function validateItems(items) {
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

  function applyLimits() {
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

  renderMealPage = function renderV2MealPage() {
    originalRenderMealPage();
    applyLimits();
  };

  document.addEventListener("keydown", (event) => {
    const input = event.target;
    if (!isMealQuantityInput(input)) return;
    if (["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectQuantityInput(input, event);
    }
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const input = event.target;
    if (!isMealQuantityInput(input) || !String(event.inputType || "").startsWith("insert")) return;
    if (event.inputType === "insertFromPaste") return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    const nextValue = `${input.value.slice(0, start)}${event.data || ""}${input.value.slice(end)}`;
    if (!/^\d*$/.test(nextValue)) rejectQuantityInput(input, event);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target;
    if (!isMealQuantityInput(input)) return;
    const pasted = event.clipboardData?.getData("text")?.trim() || "";
    if (!/^\d+$/.test(pasted)) rejectQuantityInput(input, event);
  }, true);

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!isMealQuantityInput(input)) return;
    const raw = input.value.trim();
    if (raw !== "" && !/^\d+$/.test(raw)) {
      input.value = input.dataset.lastValidMealQuantity || "0";
      rejectQuantityInput(input, event);
      return;
    }
    input.setCustomValidity("");
    input.dataset.lastValidMealQuantity = raw || "0";
  }, true);

  saveTodayMealOrder = async function saveV2MealOrder() {
    if (mealOrderState.loading) return;
    const items = readMealOrderItems();
    try {
      validateItems(items);
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

    mealOrderState = { ...mealOrderState, loading: true, error: "" };
    renderAll();
    try {
      const status = await window.schedulerApi.saveTodayMealOrder({ items });
      mealOrderState = { loading: false, status, error: "" };
      showInfoMessage(cancelling ? "今日訂餐已取消" : "訂餐已儲存");
    } catch (error) {
      mealOrderState = { ...mealOrderState, loading: false, error: error.message || "儲存訂餐失敗" };
    }
    renderAll();
  };
})();
