(function installV2MealUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;

  const originalRenderMealPage = renderMealPage;

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
