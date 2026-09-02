/* 首頁與今日訂餐頁渲染。
 * 由 renderer.js 拆分；不變更畫面內容或操作規則。
 */

function renderHomeDashboard() {
  const homeCard = document.getElementById("homeCard");
  if (!homeCard) return;
  if (!isLoggedIn()) {
    homeCard.innerHTML = "";
    return;
  }
  const actorGroup = getActorGroup();
  const showMeal = actorGroup?.mealEnabled && actorGroup?.status === "active";
  homeCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">福圓號</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
      </div>
      <div class="home-header-actions">
        <button class="ghost-btn home-password-btn" type="button" data-open-change-password="true">修改密碼</button>
        <button class="ghost-btn home-signout-btn" type="button" id="homeSignOutButton">登出</button>
      </div>
    </div>
    <div class="home-action-grid home-action-grid-three">
      <button class="home-action-card" type="button" data-home-action="schedule">
        <span class="home-action-title">班表</span>
      </button>
      ${showMeal ? `<button class="home-action-card" type="button" data-home-action="meal">
        <span class="home-action-title">訂餐</span>
      </button>` : ""}
      <button class="home-action-card" type="button" data-home-action="records">
        <span class="home-action-title">簽到簿</span>
      </button>
    </div>
  `;
}

function renderMealPage() {
  const mealCard = document.getElementById("mealCard");
  if (!mealCard) {
    return;
  }
  if (!isLoggedIn()) {
    mealCard.innerHTML = "";
    return;
  }
  const canAdminMeal = hasAnyGroupPermission("meal_admin");
  const status = mealOrderState.status;
  const products = status?.products || [];
  const showEmptyProducts = Boolean(status) && !mealOrderState.loading && products.length === 0;
  const orders = status?.orders || [];
  const pendingItems = Array.isArray(mealOrderState.pendingItems) ? mealOrderState.pendingItems : null;
  const orderQuantityMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, Number(item.quantity || 0)]))
    : new Map(orders.map((item) => [item.product_id, Number(item.quantity || 0)]));
  const orderNoteMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, item.note || ""]))
    : new Map(orders.map((item) => [item.product_id, item.note || ""]));
  const disabled = mealOrderState.loading || !status?.orderingOpen || !status?.attendance?.clock_in_at;
  const unavailableReason = !status
    ? ""
    : status.mealEnabled === false
      ? "此群組未開放訂餐"
      : !status.attendance?.clock_in_at
        ? "今日需先完成上班打卡才能訂餐"
        : !status.orderingOpen
          ? `今日訂餐已於 ${status.cutoffTime} 截止`
          : "";
  mealCard.innerHTML = `
    <div class="clock-page-header">
      <div>
        <p class="home-eyebrow">訂餐</p>
        <h1>${escapeHtml(getCurrentProfileName() || "使用者")}</h1>
        <p class="home-subtitle">訂餐日期：${escapeHtml(status?.orderDate || getTodayDateString())}，截止時間：${escapeHtml(status?.cutoffTime || "--:--")}</p>
      </div>
      ${renderHomeIconButton()}
    </div>
    ${canAdminMeal ? `
      <div class="meal-tabs" role="tablist" aria-label="訂餐頁分頁">
        <button class="ghost-btn page-tab-btn ${mealPageTab === "order" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "order" ? "true" : "false"}" data-meal-tab="order">今日訂餐</button>
        <button class="ghost-btn page-tab-btn ${mealPageTab === "stats" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "stats" ? "true" : "false"}" data-meal-tab="stats">訂餐統計</button>
        <button class="ghost-btn page-tab-btn ${mealPageTab === "settings" ? "active" : ""}" type="button" role="tab" aria-selected="${mealPageTab === "settings" ? "true" : "false"}" data-meal-tab="settings">訂餐設定</button>
      </div>
    ` : ""}
    ${canAdminMeal && mealPageTab === "settings" ? renderMealSettingsSection() : canAdminMeal && mealPageTab === "stats" ? renderMealReportSection() : `
    <section class="records-section meal-order-section">
      ${mealOrderState.error ? `<div class="auth-error clock-error">${escapeHtml(mealOrderState.error)}</div>` : ""}
    ${unavailableReason ? `<div class="auth-error clock-error">${escapeHtml(unavailableReason)}</div>` : ""}
    ${products.length ? `
      <div class="records-table-wrap meal-order-table-wrap">
        <table class="meal-order-table">
          <thead><tr><th>商品</th><th class="meal-price-col">價格</th><th class="meal-quantity-col">數量</th><th>備註</th></tr></thead>
          <tbody>
        ${products.map((product) => `
          <tr>
            <td>${escapeHtml(product.name || "")}${product.is_active === false ? "（已停用）" : ""}</td>
            <td><span class="meal-product-price">$${Number(product.price || 0).toFixed(0)}</span></td>
            <td><input type="number" min="0" step="1" value="${orderQuantityMap.get(product.id) || 0}" data-meal-product-id="${escapeHtml(product.id)}" data-meal-product-price="${Number(product.price || 0)}" ${disabled ? "disabled" : ""}></td>
            <td><input type="text" placeholder="此品項備註" value="${escapeHtml(orderNoteMap.get(product.id) || "")}" data-meal-note-product-id="${escapeHtml(product.id)}" ${disabled ? "disabled" : ""}></td>
          </tr>
        `).join("")}
          </tbody>
        </table>
      </div>
      <div class="meal-summary-row">
        <span data-meal-live-summary>目前合計 ${Number(status?.summary?.totalQuantity || 0)} 份，$${Number(status?.summary?.totalAmount || 0).toFixed(0)}</span>
        <button class="btn-primary" type="button" data-save-today-meal="true" ${disabled ? "disabled" : ""}>儲存訂餐</button>
      </div>
    ` : showEmptyProducts ? '<div class="empty-state">目前沒有可訂購的商品</div>' : ""}
    </section>
    `}
  `;
  applyMealInputLimits();
}
