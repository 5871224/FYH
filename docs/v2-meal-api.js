(function installV2MealApi() {
  const api = window.schedulerApi;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  if (!api || !baseUrl || !anonKey) return;

  async function callMealOrder(payload = {}) {
    const session = api.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/meal-order`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "訂餐設定操作失敗");
    return result;
  }

  api.getMealAdminSettings = () => callMealOrder({ action: "admin_settings" });
  api.saveMealAdminSettings = (payload = {}) => callMealOrder({
    action: "save_admin_settings",
    products: Array.isArray(payload.products) ? payload.products : [],
    dailyCutoffTime: payload.dailyCutoffTime || "10:30",
    companySubsidy: payload.companySubsidy
  });
  api.deleteMealProduct = (productId) => callMealOrder({
    action: "delete_admin_product",
    productId
  });
})();
