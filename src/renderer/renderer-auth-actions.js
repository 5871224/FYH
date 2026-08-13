/* 登入與登出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function handleSignIn() {
  const loginAccount = document.getElementById("loginAccount")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!loginAccount || !password) {
    authErrorMessage = "請輸入工號與密碼";
    renderAuthGate();
    return;
  }
  try {
    authErrorMessage = "";
    const authContext = await window.schedulerApi.signIn(loginAccount, password);
    closeSignInDialog();
    await initializeAuthenticatedHome(authContext);
    renderAll();
    syncCoreActionsMenu();
  } catch (error) {
    authErrorMessage = error.message || "登入失敗";
    renderAuthGate();
  }
}

async function handleSignOut() {
  await window.schedulerApi.signOut();
  authErrorMessage = "";
  authPromptMessage = "";
  authModalOpen = false;
  clearAuthIdentity();
  resetLoadedUserRuntimeState();
  closeModal();
  closeCoreActionsMenu();
  await loadApp();
}
