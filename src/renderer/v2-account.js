(function installV2AccountDeletion() {
  if (!window.schedulerApi || typeof renderAll !== "function") return;
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");

  async function removeProfile(employeeCode, currentPassword) {
    const session = window.schedulerApi.getAuthContext?.().session;
    if (!session?.access_token) throw new Error("請先登入");
    const response = await fetch(`${baseUrl}/functions/v1/member-delete-v2`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ employeeCode, currentPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "刪除人員失敗");
    return result;
  }

  deleteMember = async function deleteMemberV2(memberId) {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) return;
    if (!canEditMemberAccount(member)) {
      showInfoMessage("沒有權限刪除此帳號");
      return;
    }

    const selfDelete = member.code === currentProfile?.employee_code;
    const confirmed = await confirmAction(selfDelete
      ? "確定要刪除自己的帳號嗎？刪除後會立即登出。"
      : "確定要刪除這位人員嗎？");
    if (!confirmed) return;

    let currentPassword = "";
    if (selfDelete) {
      currentPassword = window.prompt("請輸入目前密碼以確認刪除帳號：") || "";
      if (!currentPassword) {
        showInfoMessage("未輸入目前密碼，已取消刪除");
        return;
      }
    }

    try {
      await removeProfile(member.code, currentPassword);
    } catch (error) {
      showInfoMessage(error.message || "刪除人員失敗");
      return;
    }

    if (selfDelete) {
      await window.schedulerApi.signOut();
      window.location.reload();
      return;
    }

    state.members = state.members.filter((item) => item.id !== memberId);
    state.members = state.members.map((item) => ({
      ...item,
      proxyMemberId: item.proxyMemberId === memberId ? "" : item.proxyMemberId
    }));
    renderAll();
    openMemberSettings();
  };
})();
