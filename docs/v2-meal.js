(function installV2MealUi() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;

  const originalRenderMealPage = renderMealPage;
  const quantityError = "訂餐數量只能輸入 0 或正整數";
  const subsidyError = "公司補助只能輸入正整數";

  if (!document.getElementById("v2MealLayoutStyle")) {
    const style = document.createElement("style");
    style.id = "v2MealLayoutStyle";
    style.textContent = `
      .meal-card { width: min(1100px, 100%); }
      .meal-settings-table { width: 100%; table-layout: fixed; }
      .meal-settings-table th,
      .meal-settings-table td { min-width: 0; }
      .meal-settings-drag-col { width: 42px; text-align: center; }
      .meal-settings-name-col { width: auto; }
      .meal-settings-price-col { width: 104px; }
      .meal-settings-active-col { width: 70px; text-align: center; }
      .meal-settings-operation-col { width: 72px; white-space: nowrap; text-align: center; }
      .meal-settings-name-col input,
      .meal-settings-price-col input { width: 100%; min-width: 0; }
      .meal-settings-operation-col .ghost-btn { padding: 7px 12px; }
      .meal-drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .meal-drag-handle:active { cursor: grabbing; }
      .meal-settings-toolbar-label { display: inline-flex; align-items: center; gap: 8px; }
      .meal-settings-toolbar-label input[type="number"] { width: 92px; }
    `;
    document.head.appendChild(style);
  }

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
    rejectInput(input, event, quantityError);
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

  renderMealSettingsSection = function renderV2MealSettingsSection() {
    const mealAdmin = recordsState.mealAdmin;
    const subsidy = Number(mealAdmin.settings?.company_subsidy || 55);
    return `<section class="records-section">
      <h2>訂餐設定</h2>
      <div class="records-filter-row">
        <label class="meal-settings-toolbar-label">截止時間 <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time></label>
        <label class="meal-settings-toolbar-label">公司補助 <input type="number" min="1" step="1" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeHtml(String(subsidy))}" data-meal-company-subsidy data-last-valid-company-subsidy="${escapeHtml(String(subsidy))}"></label>
        <button class="ghost-btn compact-btn" type="button" data-add-meal-product="true">新增商品</button>
        <button class="primary-btn compact-btn" type="button" data-save-meal-settings="true">儲存</button>
      </div>
      ${mealAdmin.error ? `<div class="auth-error">${escapeHtml(mealAdmin.error)}</div>` : ""}
      <div class="meal-settings-table-wrap">
        <table class="meal-settings-table">
          <thead><tr><th class="meal-settings-drag-col"></th><th class="meal-settings-name-col">品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th><th class="meal-settings-operation-col">操作</th></tr></thead>
          <tbody>${mealAdmin.products.map((product, index) => `<tr data-meal-product-row="${index}">
            <td class="meal-settings-drag-col"><span class="meal-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span></td>
            <td class="meal-settings-name-col"><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td>
            <td class="meal-settings-price-col"><input type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}" data-meal-product-field="price"></td>
            <td class="meal-settings-active-col"><input type="checkbox" ${product.is_active !== false ? "checked" : ""} data-meal-product-field="isActive"><input type="hidden" value="${escapeHtml(product.id || "")}" data-meal-product-field="id"></td>
            <td class="meal-settings-operation-col"><button class="ghost-btn compact-btn" type="button" data-delete-meal-product="${escapeHtml(String(index))}">刪除</button></td>
          </tr>`).join("") || '<tr><td colspan="5">尚無商品</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  };

  renderMealPage = function renderV2MealPage() {
    originalRenderMealPage();
    applyLimits();
  };

  saveMealSettingsFromPage = async function saveV2MealSettingsFromPage() {
    const subsidyInput = document.querySelector("[data-meal-company-subsidy]");
    const rawSubsidy = subsidyInput instanceof HTMLInputElement ? subsidyInput.value.trim() : "";
    if (!/^[1-9]\d*$/.test(rawSubsidy)) {
      if (subsidyInput instanceof HTMLInputElement) rejectInput(subsidyInput, null, subsidyError);
      return;
    }
    try {
      await window.schedulerApi.saveMealAdminSettings({
        dailyCutoffTime: document.querySelector("[data-meal-cutoff-time]")?.value || "10:30",
        companySubsidy: Number(rawSubsidy),
        products: readMealAdminProducts()
      });
      await loadMealAdminSettings();
      showInfoMessage("訂餐設定已儲存");
    } catch (error) {
      setSaveStatus(`訂餐設定儲存失敗：${error.message}`);
    }
  };

  async function deleteMealProduct(button) {
    const row = button.closest("[data-meal-product-row]");
    if (!(row instanceof HTMLTableRowElement)) return;
    const productId = row.querySelector('[data-meal-product-field="id"]')?.value || "";
    const productName = row.querySelector('[data-meal-product-field="name"]')?.value?.trim() || "此品項";
    const rowIndex = Number(row.dataset.mealProductRow || button.dataset.deleteMealProduct || -1);

    if (!productId) {
      if (rowIndex >= 0) recordsState.mealAdmin.products.splice(rowIndex, 1);
      renderAll();
      return;
    }

    const confirmed = await confirmAction(`確定刪除「${productName}」嗎？已有訂餐記錄的品項不能刪除，只能取消啟用。`);
    if (!confirmed) return;
    try {
      await window.schedulerApi.deleteMealProduct(productId);
      await loadMealAdminSettings(false);
      renderAll();
      showInfoMessage("品項已刪除");
    } catch (error) {
      showInfoMessage(error.message || "刪除品項失敗");
    }
  }

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const mealProductRow = target.closest("[data-meal-product-row]");
    if (mealProductRow && !target.closest(".meal-drag-handle")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    const input = event.target;
    if (isMealQuantityInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectQuantityInput(input, event);
    }
    if (isCompanySubsidyInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {
      rejectInput(input, event, subsidyError);
    }
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !String(event.inputType || "").startsWith("insert")) return;
    if (event.inputType === "insertFromPaste") return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    const nextValue = `${input.value.slice(0, start)}${event.data || ""}${input.value.slice(end)}`;
    if (isMealQuantityInput(input) && !/^\d*$/.test(nextValue)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^(?:|[1-9]\d*)$/.test(nextValue)) rejectInput(input, event, subsidyError);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const pasted = event.clipboardData?.getData("text")?.trim() || "";
    if (isMealQuantityInput(input) && !/^\d+$/.test(pasted)) rejectQuantityInput(input, event);
    if (isCompanySubsidyInput(input) && !/^[1-9]\d*$/.test(pasted)) rejectInput(input, event, subsidyError);
  }, true);

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (isMealQuantityInput(input)) {
      const raw = input.value.trim();
      if (raw !== "" && !/^\d+$/.test(raw)) {
        input.value = input.dataset.lastValidMealQuantity || "0";
        rejectQuantityInput(input, event);
        return;
      }
      input.setCustomValidity("");
      input.dataset.lastValidMealQuantity = raw || "0";
      return;
    }
    if (isCompanySubsidyInput(input)) {
      const raw = input.value.trim();
      if (raw !== "" && !/^[1-9]\d*$/.test(raw)) {
        input.value = input.dataset.lastValidCompanySubsidy || "55";
        rejectInput(input, event, subsidyError);
        return;
      }
      input.setCustomValidity("");
      if (raw) input.dataset.lastValidCompanySubsidy = raw;
    }
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-meal-product]");
    if (button) void deleteMealProduct(button);
  });

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
