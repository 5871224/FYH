/* 登入與登出操作。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function getSignInErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  let errorCode = "";
  let message = rawMessage;

  if (rawMessage.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawMessage);
      errorCode = String(parsed?.error_code || parsed?.code || "").trim().toLowerCase();
      message = String(
        parsed?.message
        || parsed?.msg
        || parsed?.error_description
        || parsed?.error
        || rawMessage
      ).trim();
    } catch {
      // 非 JSON 訊息直接沿用原文。
    }
  }

  if (errorCode === "invalid_credentials" || /invalid login credentials|invalid_credentials/i.test(message)) {
    return "工號或密碼有誤";
  }
  return message || "登入失敗，請稍後再試";
}

function getSignInInputError(loginAccount, password) {
  const employeeCode = String(loginAccount ?? "");
  if (!employeeCode || !password) {
    return "請輸入工號與密碼";
  }
  if (employeeCode !== employeeCode.trim() || !/^[A-Za-z0-9._-]+$/.test(employeeCode)) {
    return "工號格式錯誤";
  }
  return "";
}

async function handleSignIn() {
  const loginAccount = document.getElementById("loginAccount")?.value || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const inputError = getSignInInputError(loginAccount, password);
  if (inputError) {
    authErrorMessage = inputError;
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
    authErrorMessage = getSignInErrorMessage(error);
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
