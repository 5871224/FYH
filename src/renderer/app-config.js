window.SCHEDULER_CONFIG = {
  supabaseUrl: "https://crxxkazdgsaqwqrppbhy.supabase.co",
  supabaseAnonKey: "sb_publishable_t4QuCEqPIF_q2YO9VYa0QA_z7S3JFt7",
  documentId: "default"
};

if (typeof document !== "undefined" && typeof document.write === "function") {
  document.write('<link rel="stylesheet" href="./groups.css?v=20260807-public-directory-group-tags">');
  document.write('<script src="./login-fast-home.mjs?v=20260731-login-fast-home"><\/script>');
  document.write('<script src="./app-config-base.mjs?v=20260730-toolbar-compact"><\/script>');
  document.write('<script src="./toolbar-compact.mjs?v=20260730-toolbar-compact"><\/script>');
  document.write('<script defer src="./renderer-groups-permissions-archive.mjs?v=20260807-public-directory-group-tags"><\/script>');
  document.write('<script defer src="./renderer-group-backend-bridges.mjs?v=20260806-group-backend-bridges"><\/script>');

  document.addEventListener("DOMContentLoaded", () => {
    let attempts = 0;
    let groupAccessLoadPromise = null;

    const loadGroupAccessForHome = async () => {
      if (typeof loadGroupAccessData !== "function") return;
      const actor = typeof getAccessActor === "function" ? getAccessActor() : {};
      if (!actor?.groupId) {
        if (!groupAccessLoadPromise) {
          groupAccessLoadPromise = loadGroupAccessData().finally(() => {
            groupAccessLoadPromise = null;
          });
        }
        await groupAccessLoadPromise;
      }
      if (typeof syncPermissionUi === "function") syncPermissionUi();
    };

    const retryGroupFeatureInitialization = () => {
      attempts += 1;
      if (attempts < 40) setTimeout(ensureGroupFeatureInitialized, 250);
    };

    const ensureGroupFeatureInitialized = async () => {
      if (
        typeof groupFeatureState === "object"
        && typeof loadGroupAccessData === "function"
        && typeof reloadGroupApplicationState === "function"
        && window.schedulerApi?.getAuthContext?.()?.session
      ) {
        try {
          await loadGroupAccessForHome();
          if (!groupFeatureState.initialized) {
            await reloadGroupApplicationState();
          }
        } catch (error) {
          console.error("群組功能初始化失敗", error);
          retryGroupFeatureInitialization();
        }
        return;
      }
      retryGroupFeatureInitialization();
    };
    void ensureGroupFeatureInitialized();
  });
}
