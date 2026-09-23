/* 繁中／越文語系。
 * 固定介面文字在正式 Renderer 渲染後翻譯；資料名稱沿用 nameVi，空白時維持中文。
 */
const fyhLocalization = (() => {

  const LANGUAGE_KEY = "fyh.language";
  const VI = "vi-VN";
  const ZH = "zh-TW";
  let language = localStorage.getItem(LANGUAGE_KEY) === VI ? VI : ZH;
  let labelsLoaded = false;
  let labels = { groups: [], departments: [], members: [], shifts: [], leaves: [], roles: [], mealProducts: [] };
  let applying = false;

  const fixedVi = new Map(Object.entries({
    "首頁": "Trang chủ",
    "打卡": "Chấm công",
    "訂餐": "Đặt cơm",
    "紀錄": "Lịch sử",
    "簽到簿": "Sổ chấm công",
    "班表": "Lịch làm việc",
    "登入": "Đăng nhập",
    "登出": "Đăng xuất",
    "修改密碼": "Đổi mật khẩu",
    "語言": "Ngôn ngữ",
    "設定": "Cài đặt",
    "排班": "Xếp ca",
    "匯出": "Xuất dữ liệu",
    "匯入": "Nhập dữ liệu",
    "功能": "Chức năng",
    "班別": "Ca làm việc",
    "假別": "Loại nghỉ",
    "加班": "Tăng ca",
    "例休檢查": "Kiểm tra ngày nghỉ",
    "權限設定": "Cài đặt quyền",
    "群組設定": "Cài đặt nhóm",
    "修改群組": "Sửa nhóm",
    "新增群組": "Thêm nhóm",
    "週期設定": "Cài đặt chu kỳ",
    "班表封存": "Lưu trữ lịch",
    "排班條件": "Điều kiện xếp ca",
    "修改排班條件": "Sửa điều kiện xếp ca",
    "新增排班條件": "Thêm điều kiện xếp ca",
    "封存班表": "Lịch đã lưu trữ",
    "自動排班期間": "Khoảng thời gian xếp ca tự động",
    "自動補班期間": "Khoảng thời gian bổ sung ca tự động",
    "產生預覽": "Tạo bản xem trước",
    "預覽列印": "Xem trước khi in",
    "條件類型": "Loại điều kiện",
    "限額": "Giới hạn",
    "同班限制": "Giới hạn cùng ca",
    "同休限制": "Giới hạn cùng nghỉ",
    "目前未生效": "Chưa có hiệu lực",
    "目前還沒有排班條件": "Hiện chưa có điều kiện xếp ca",
    "請選擇人員": "Chọn nhân viên",
    "日期範圍": "Khoảng ngày",
    "封存時間": "Thời gian lưu trữ",
    "封存人員": "Người lưu trữ",
    "人員數": "Số nhân viên",
    "資料筆數": "Số bản ghi",
    "封存": "Lưu trữ",
    "解除封存": "Bỏ lưu trữ",
    "尚無封存班表": "Chưa có lịch đã lưu trữ",
    "群組－單位": "Nhóm－Bộ phận",
    "沒有班表資料": "Không có dữ liệu lịch làm việc",
    "班表查看": "Xem lịch làm việc",
    "班表管理": "Quản lý lịch làm việc",
    "八週起算日": "Ngày bắt đầu chu kỳ 8 tuần",
    "每週起算日": "Ngày bắt đầu tuần",
    "每月起算日": "Ngày bắt đầu tháng",
    "說明": "Giải thích",
    "星期日": "Chủ nhật",
    "星期一": "Thứ hai",
    "星期二": "Thứ ba",
    "星期三": "Thứ tư",
    "星期四": "Thứ năm",
    "星期五": "Thứ sáu",
    "星期六": "Thứ bảy",
    "週日": "Chủ nhật",
    "週一": "Thứ hai",
    "週二": "Thứ ba",
    "週三": "Thứ tư",
    "週四": "Thứ năm",
    "週五": "Thứ sáu",
    "週六": "Thứ bảy",
    "重設密碼為 000000": "Đặt lại mật khẩu thành 000000",
    "密碼至少需要 6 個字元。": "Mật khẩu phải có ít nhất 6 ký tự.",
    "同步人員資料失敗：密碼至少需要 6 個字元。": "Đồng bộ dữ liệu nhân viên thất bại: Mật khẩu phải có ít nhất 6 ký tự.",
    "重設密碼失敗：密碼至少需要 6 個字元。": "Đặt lại mật khẩu thất bại: Mật khẩu phải có ít nhất 6 ký tự.",
    "自動排班預覽": "Xem trước xếp ca tự động",
    "自動補班預覽": "Xem trước bổ sung ca",
    "套用預覽": "Áp dụng bản xem trước",
    "取消預覽": "Hủy bản xem trước",
    "匯出上班日": "Xuất ngày làm việc",
    "匯出休例假": "Xuất ngày nghỉ",
    "匯出請假": "Xuất nghỉ phép",
    "匯出加班": "Xuất tăng ca",
    "列印班表": "In lịch làm việc",
    "班表列印預覽": "Xem trước lịch in",
    "列印": "In",
    "返回": "Quay lại",
    "方向": "Hướng",
    "每頁人數": "Số người mỗi trang",
    "每頁日期數": "Số ngày mỗi trang",
    "自動": "Tự động",
    "直式": "Dọc",
    "橫式": "Ngang",
    "前八週": "8 tuần trước",
    "前一週": "Tuần trước",
    "後一週": "Tuần sau",
    "後八週": "8 tuần sau",
    "人員檢視": "Theo nhân viên",
    "人員檢視-統計欄": "Theo nhân viên - thống kê",
    "班別檢視": "Theo ca",
    "單位": "Bộ phận",
    "人員": "Nhân viên",
    "員工": "Nhân viên",
    "統計": "Thống kê",
    "姓名": "Họ tên",
    "工號": "Mã nhân viên",
    "開始日期": "Ngày bắt đầu",
    "結束日期": "Ngày kết thúc",
    "到職日": "Ngày vào làm",
    "離職日": "Ngày nghỉ việc",
    "狀態": "Trạng thái",
    "操作": "Thao tác",
    "編輯": "Sửa",
    "刪除": "Xóa",
    "新增": "Thêm",
    "儲存": "Lưu",
    "儲存修改": "Lưu thay đổi",
    "取消": "Hủy",
    "確認": "Xác nhận",
    "全部": "Tất cả",
    "全部顯示": "Hiển thị tất cả",
    "全部群組": "Tất cả nhóm",
    "全部人員": "Tất cả nhân viên",
    "全部單位": "Tất cả bộ phận",
    "未指定": "Chưa chỉ định",
    "未設定": "Chưa cài đặt",
    "啟用": "Bật",
    "停用": "Tắt",
    "是": "Có",
    "否": "Không",
    "月薪": "Lương tháng",
    "日薪": "Lương ngày",
    "計薪方式": "Cách tính lương",
    "例假星期": "Ngày nghỉ cố định",
    "所屬群組": "Nhóm",
    "所屬單位": "Bộ phận",
    "排班班別": "Ca có thể xếp",
    "群組": "Nhóm",
    "群組名稱": "Tên nhóm",
    "群組代碼": "Mã nhóm",
    "單位名稱": "Tên bộ phận",
    "越文名稱": "Tên tiếng Việt",
    "所屬人員": "Nhân viên thuộc bộ phận",
    "預覽": "Xem trước",
    "底色": "Màu nền",
    "字色": "Màu chữ",
    "自動字色": "Màu chữ tự động",
    "假別代碼": "Mã loại nghỉ",
    "適用單位": "Bộ phận áp dụng",
    "需求人數": "Số người cần",
    "排班人員": "Nhân viên xếp ca",
    "時段": "Khung giờ",
    "需填時間": "Yêu cầu nhập giờ",
    "需填原因": "Yêu cầu lý do",
    "角色名稱": "Tên vai trò",
    "適用群組": "Nhóm áp dụng",
    "權限項目": "Quyền hạn",
    "共用權限": "Quyền dùng chung",
    "群組權限": "Quyền theo nhóm",
    "權限": "Quyền",
    "在職": "Đang làm việc",
    "離職": "Đã nghỉ việc",
    "名稱": "Tên",
    "上班時間": "Giờ vào ca",
    "下班時間": "Giờ tan ca",
    "查看": "Xem",
    "管理": "Quản lý",
    "修改單位": "Sửa bộ phận",
    "新增單位": "Thêm bộ phận",
    "修改人員": "Sửa nhân viên",
    "新增人員": "Thêm nhân viên",
    "修改班別": "Sửa ca",
    "新增班別": "Thêm ca",
    "修改假別": "Sửa loại nghỉ",
    "新增假別": "Thêm loại nghỉ",
    "修改角色": "Sửa vai trò",
    "新增角色": "Thêm vai trò",
    "不顯示於班表": "Không hiển thị trên lịch",
    "請輸入單位名稱": "Nhập tên bộ phận",
    "請輸入班別": "Nhập tên ca",
    "請輸入名稱": "Nhập tên",
    "輸入姓名": "Nhập họ tên",
    "可留空": "Có thể để trống",
    "可留空；越文模式會顯示中文": "Có thể để trống; nếu trống sẽ hiển thị tiếng Trung",
    "可否訂餐": "Cho phép đặt cơm",
    "不顯示": "Không hiển thị",
    "可否打卡": "Cho phép chấm công",
    "是否啟用打卡": "Bật chấm công",
    "地址": "Địa chỉ",
    "緯度": "Vĩ độ",
    "經度": "Kinh độ",
    "固定對外 IP": "IP công cộng cố định",
    "人員設定": "Cài đặt nhân viên",
    "單位設定": "Cài đặt bộ phận",
    "班別設定": "Cài đặt ca",
    "假別設定": "Cài đặt loại nghỉ",
    "訂餐管理": "Quản lý đặt cơm",
    "訂餐設定": "Cài đặt đặt cơm",
    "品項": "Món",
    "價格": "Giá",
    "公司補助（元）": "Trợ cấp công ty (NT$)",
    "新增商品": "Thêm món",
    "儲存設定": "Lưu cài đặt",
    "今日訂餐": "Đặt cơm hôm nay",
    "數量": "Số lượng",
    "單價": "Đơn giá",
    "小計": "Thành tiền",
    "備註": "Ghi chú",
    "常用備註": "Ghi chú thường dùng",
    "個人記錄": "Lịch sử cá nhân",
    "簽到審核": "Duyệt chấm công",
    "日期": "Ngày",
    "圖示": "Biểu tượng",
    "打卡時間": "Giờ chấm công",
    "上班時數": "Giờ làm việc",
    "加班時數": "Giờ tăng ca",
    "異常": "Bất thường",
    "審核": "Duyệt",
    "未審": "Chưa duyệt",
    "已審": "Đã duyệt",
    "批次審核": "Duyệt hàng loạt",
    "批次退回": "Trả lại hàng loạt",
    "設為未審": "Đặt thành chưa duyệt",
    "設為已審": "Đặt thành đã duyệt",
    "歷程": "Lịch sử",
    "上班": "Vào ca",
    "下班": "Tan ca",
    "上班打卡": "Chấm công vào ca",
    "下班打卡": "Chấm công tan ca",
    "上一頁": "Trang trước",
    "下一頁": "Trang sau",
    "讀取中…": "Đang tải…",
    "載入中…": "Đang tải…",
    "沒有資料": "Không có dữ liệu",
    "正常": "Bình thường",
    "使用者": "Người dùng",
    "拖曳排序": "Kéo để sắp xếp",
    "返回首頁": "Về trang chủ",
    "上一步（Ctrl+Z）": "Hoàn tác (Ctrl+Z)",
    "下一步（Ctrl+Y）": "Làm lại (Ctrl+Y)",
    "收合工具列": "Thu gọn thanh công cụ"
  }));

  function normalizeLabelRows(value) {
    return Array.isArray(value) ? value.map((row) => ({ id: String(row?.id || ""), nameVi: String(row?.nameVi || "").trim() })) : [];
  }

  function setLabels(payload) {
    labels = {
      groups: normalizeLabelRows(payload?.groups),
      departments: normalizeLabelRows(payload?.departments),
      members: normalizeLabelRows(payload?.members),
      shifts: normalizeLabelRows(payload?.shifts),
      leaves: normalizeLabelRows(payload?.leaves),
      roles: normalizeLabelRows(payload?.roles),
      mealProducts: normalizeLabelRows(payload?.mealProducts)
    };
    labelsLoaded = true;
  }

  function labelMap(category) {
    return new Map((labels[category] || []).map((row) => [row.id, row.nameVi]));
  }

  function applyLabels(items, category) {
    const byId = labelMap(category);
    return Array.isArray(items) ? items.map((item) => ({ ...item, nameVi: byId.get(String(item?.id || "")) || item?.nameVi || "" })) : items;
  }

  function mergeGlobalLabels() {
    try {
      if (typeof state !== "undefined" && state) {
        state.departments = applyLabels(state.departments, "departments");
        state.members = applyLabels(state.members, "members");
        state.shifts = applyLabels(state.shifts, "shifts");
        state.leaves = applyLabels(state.leaves, "leaves");
      }
      if (typeof groupFeatureState !== "undefined" && groupFeatureState?.bundle) {
        groupFeatureState.bundle.groups = applyLabels(groupFeatureState.bundle.groups, "groups");
        groupFeatureState.bundle.roles = applyLabels(groupFeatureState.bundle.roles, "roles");
      }
      if (typeof recordsState !== "undefined" && recordsState?.mealAdmin?.products) {
        recordsState.mealAdmin.products = applyLabels(recordsState.mealAdmin.products, "mealProducts");
      }
      if (typeof mealOrderState !== "undefined" && mealOrderState?.status?.products) {
        mealOrderState.status.products = applyLabels(mealOrderState.status.products, "mealProducts");
      }
    } catch (error) {
      console.warn("套用越文名稱失敗", error);
    }
  }

  let labelRefreshPromise = null;

  function isAuthenticated() {
    return Boolean(window.schedulerApi?.getAuthContext?.()?.authenticated);
  }

  async function refreshLabels() {
    if (!isAuthenticated() || typeof window.schedulerApi?.getVietnameseLabels !== "function") return labels;
    if (labelRefreshPromise) return labelRefreshPromise;
    labelRefreshPromise = Promise.resolve(window.schedulerApi.getVietnameseLabels())
      .then((payload) => {
        setLabels(payload || {});
        mergeGlobalLabels();
        return labels;
      })
      .finally(() => { labelRefreshPromise = null; });
    return labelRefreshPromise;
  }

  function upsertCachedLabel(category, id, nameVi) {
    if (!id) return;
    const rows = labels[category] || [];
    const index = rows.findIndex((row) => row.id === id);
    const next = { id, nameVi: String(nameVi || "").trim() };
    if (index >= 0) rows[index] = next;
    else rows.push(next);
  }

  async function saveLabel(entity, category, id, value) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || typeof window.schedulerApi?.saveVietnameseLabel !== "function") return;
    await window.schedulerApi.saveVietnameseLabel(entity, normalizedId, String(value || "").trim());
    upsertCachedLabel(category, normalizedId, value);
    mergeGlobalLabels();
  }

  function entityTranslationMap() {
    const map = new Map();
    const add = (items) => (items || []).forEach((item) => {
      const zh = String(item?.name || item?.full_name || "").trim();
      const vi = String(item?.nameVi || "").trim();
      if (zh && vi) map.set(zh, vi);
    });
    try {
      if (typeof groupFeatureState !== "undefined") { add(groupFeatureState.bundle?.groups); add(groupFeatureState.bundle?.roles); }
      if (typeof state !== "undefined") {
        add(state.departments); add(state.members); add(state.shifts); add(state.leaves);
      }
      if (typeof recordsState !== "undefined") add(recordsState.mealAdmin?.products);
      if (typeof mealOrderState !== "undefined") add(mealOrderState.status?.products);
    } catch {}
    return map;
  }

  function normalizeAuthErrorText(text) {
    return String(text || "")
      .replace(/Password should be at least 6 characters\.?/gi, "密碼至少需要 6 個字元。");
  }

  function translateDynamic(text, entityMap) {
    const resetConfirm = text.match(/^確定要將 (.+) 的密碼重設為 000000 嗎？$/);
    if (resetConfirm) return `Bạn có chắc muốn đặt lại mật khẩu của ${resetConfirm[1]} thành 000000 không?`;
    const resetSuccess = text.match(/^(.+) 的密碼已重設為 000000$/);
    if (resetSuccess) return `Mật khẩu của ${resetSuccess[1]} đã được đặt lại thành 000000`;
    const conditionTitle = text.match(/^排班條件－(.+)$/);
    if (conditionTitle) return `Điều kiện xếp ca－${entityMap.get(conditionTitle[1]) || conditionTitle[1]}`;
    const archiveTitle = text.match(/^(.+)封存班表$/);
    if (archiveTitle) return `${entityMap.get(archiveTitle[1]) || archiveTitle[1]}－Lịch đã lưu trữ`;
    const monthDay = text.match(/^(\d{1,2})\s*日$/);
    if (monthDay) return `Ngày ${Number(monthDay[1])}`;
    const month = text.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月$/);
    if (month) return `Tháng ${Number(month[2])} năm ${month[1]}`;
    const page = text.match(/^共\s*(\d+)\s*筆，第\s*(\d+)\s*\/\s*(\d+)\s*頁$/);
    if (page) return `Tổng ${page[1]} mục, trang ${page[2]} / ${page[3]}`;
    const total = text.match(/^目前合計\s*(\d+)\s*份，\$(.+)$/);
    if (total) return `Tổng hiện tại ${total[1]} phần, $${total[2]}`;
    return "";
  }

  function translateText(text, entityMap) {
    const normalizedText = normalizeAuthErrorText(text);
    const trimmed = normalizedText.trim();
    if (!trimmed) return normalizedText;
    if (language !== VI) return normalizedText;
    const translated = fixedVi.get(trimmed) || entityMap.get(trimmed) || translateDynamic(trimmed, entityMap);
    if (!translated) return normalizedText;
    const leading = normalizedText.match(/^\s*/)?.[0] || "";
    const trailing = normalizedText.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function translateDom(root = document.body) {
    if (!root || applying) return;
    applying = true;
    try {
      const entities = entityTranslationMap();
      const viTextValues = new Set([...fixedVi.values(), ...entities.values()]
        .map((value) => String(value || "").trim())
        .filter(Boolean));
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;
        const before = node.nodeValue || "";
        const next = translateText(before, entities);
        if (next !== before) {
          node.nodeValue = next;
          if (language === VI) parent.classList.add("fyh-vi-text");
        } else if (language === VI && viTextValues.has(String(before).trim())) {
          parent.classList.add("fyh-vi-text");
        }
      });
      root.querySelectorAll?.("[title], [aria-label], [placeholder]").forEach((element) => {
        ["title", "aria-label", "placeholder"].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) return;
          const next = translateText(value, entities).trim();
          if (next !== value) {
            element.setAttribute(attribute, next);
            if (language === VI && attribute === "placeholder") element.classList.add("fyh-vi-placeholder");
          }
        });
      });
      document.documentElement.lang = language === VI ? "vi" : "zh-TW";
    } finally {
      applying = false;
    }
  }

  function renderLanguageControl() {
    return `<div class="fyh-language-switch"><select id="fyhLanguageSelect" aria-label="語言"><option value="${ZH}" ${language === ZH ? "selected" : ""}>繁體中文</option><option value="${VI}" ${language === VI ? "selected" : ""}>Tiếng Việt</option></select></div>`;
  }

  function setLanguage(value) {
    localStorage.setItem(LANGUAGE_KEY, value === VI ? VI : ZH);
    window.location.reload();
  }

  function prepareData() {
    if (labelsLoaded) mergeGlobalLabels();
  }

  function refresh(root = document.body) {
    prepareData();
    if (isAuthenticated() && !labelsLoaded && !labelRefreshPromise) {
      refreshLabels()
        .then(() => queueMicrotask(() => refresh(document.body)))
        .catch((error) => console.warn("讀取越文名稱失敗", error));
    }
    translateDom(root);
  }

  return {
    get language() { return language; },
    isVietnamese: () => language === VI,
    displayName(item) {
      const vi = String(item?.nameVi || "").trim();
      return language === VI && vi ? vi : String(item?.name || "");
    },
    refreshLabels,
    saveLabel,
    refresh,
    prepareData,
    renderLanguageControl,
    setLanguage
  };
})();

window.fyhI18n = {
  get language() { return fyhLocalization.language; },
  isVietnamese: fyhLocalization.isVietnamese,
  displayName: fyhLocalization.displayName,
  refreshLabels: fyhLocalization.refreshLabels,
  saveLabel: fyhLocalization.saveLabel,
  refresh: fyhLocalization.refresh
};

function prepareLocalizationData() {
  fyhLocalization.prepareData();
}

function refreshLocalization(root = document.body) {
  fyhLocalization.refresh(root);
}

function renderLanguageControl() {
  return fyhLocalization.renderLanguageControl();
}

function setApplicationLanguage(value) {
  fyhLocalization.setLanguage(value);
}
