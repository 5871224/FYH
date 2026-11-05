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
    <header class="home-topbar">
      <div class="home-brand-mark">
        <svg class="home-brand-filter" width="0" height="0" aria-hidden="true" focusable="false"><defs><filter id="homeBrandContrast" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-0.11745 0.11186 0 0 1.00559  -1.14613 1.13484 0 0 1.01128  -1.06833 1.12569 0 0 0.94265  0 0 0 1 0"/></filter></defs></svg>
        <img class="home-brand-logo" src="https://www.fyh1971.com/archive/image/weblogo/LOGO-3.png" alt="福圓號 SINCE1971" referrerpolicy="no-referrer">
      </div>
      <div class="home-header-actions">
        <div class="home-language-control">${renderLanguageControl()}</div>
        <details class="home-account-menu">
          <summary class="home-account-trigger" aria-label="帳號選單">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"></path></svg>
            <span class="home-account-name">${escapeHtml(getCurrentProfileName() || "使用者")}</span>
            <svg class="home-account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
          </summary>
          <div class="home-account-options">
            <button type="button" data-open-change-password="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="16" r="3"></circle><path d="m10 14 10-10 2 2-2 2 1 1-3 3-2-2-4 4"></path></svg>
              修改密碼
            </button>
            <button type="button" id="homeSignOutButton">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H5v16h6M14 8l4 4-4 4M9 12h9"></path></svg>
              登出
            </button>
          </div>
        </details>
      </div>
    </header>
    <main class="home-main">
      <div class="home-action-grid${showMeal ? " home-action-grid-with-meal" : ""}">
      <button class="home-action-card" type="button" data-home-action="schedule">
        <span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"></rect><path d="M7 3v4M17 3v4M3 10h18"></path><circle cx="8" cy="14" r=".7"></circle><circle cx="12" cy="14" r=".7"></circle><circle cx="16" cy="14" r=".7"></circle><circle cx="8" cy="18" r=".7"></circle><circle cx="12" cy="18" r=".7"></circle><circle cx="16" cy="18" r=".7"></circle></svg></span>
        <span class="home-action-title">班表</span>
      </button>
      ${showMeal ? `<button class="home-action-card" type="button" data-home-action="meal">
        <span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><g transform="rotate(-40 12 12)"><ellipse cx="7" cy="5.5" rx="3" ry="4.25"></ellipse><path d="M7 9.7V21"></path></g><g transform="rotate(40 12 12)"><path d="M14 2v7c0 2 1.3 3 3 3s3-1 3-3V2M17 2v19"></path></g></svg></span>
        <span class="home-action-title">訂餐</span>
      </button>` : ""}
      <button class="home-action-card" type="button" data-home-action="records">
        <span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 6.5V12l4.5 2.7"></path></svg></span>
        <span class="home-action-title">簽到簿</span>
      </button>
    </div>
    </main>
    <svg class="home-bottom-waves" aria-hidden="true" viewBox="0 0 1000 160" preserveAspectRatio="none">
      <path d="M0 92 C210 17 353 153 552 120 C738 91 830 32 1000 0 V160 H0Z" fill="#f2dfd0"/>
      <path d="M0 124 C205 60 337 166 554 151 C735 139 895 66 1000 47 V160 H0Z" fill="#e9d1bd" opacity=".73"/>
      <path d="M0 147 C190 113 345 172 577 157 C746 145 887 111 1000 80 V160 H0Z" fill="#dcc0a9" opacity=".27"/>
    </svg>
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
