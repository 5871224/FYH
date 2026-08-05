/* 排班主程式共用常數與初始狀態工廠
 * 由固定建置清單載入。
 */

const COLORS = [
  { hex: "#378ADD", label: "藍色" },
  { hex: "#185FA5", label: "深藍" },
  { hex: "#23395B", label: "海軍藍" },
  { hex: "#355070", label: "鋼藍" },
  { hex: "#1D9E75", label: "綠色" },
  { hex: "#2F6F4F", label: "墨綠" },
  { hex: "#2A9D8F", label: "青綠" },
  { hex: "#3A5A40", label: "森林綠" },
  { hex: "#E24B4A", label: "紅色" },
  { hex: "#9C2F2F", label: "深紅" },
  { hex: "#A44A3F", label: "磚紅" },
  { hex: "#D85A30", label: "橘紅" },
  { hex: "#EF9F27", label: "橙色" },
  { hex: "#C46B2D", label: "土橘" },
  { hex: "#BA7517", label: "琥珀" },
  { hex: "#639922", label: "草綠" },
  { hex: "#7F77DD", label: "紫色" },
  { hex: "#5B4B8A", label: "深紫" },
  { hex: "#8F3B76", label: "莓紫" },
  { hex: "#6D597A", label: "灰紫" },
  { hex: "#D4537E", label: "粉紅" },
  { hex: "#5DCAA5", label: "薄荷" },
  { hex: "#888780", label: "石灰" }
];

const LEAVE_CATALOG = [
  { code: "0010", name: "事假" },
  { code: "0011", name: "病假" },
  { code: "0012", name: "婚假" },
  { code: "0013", name: "喪假" },
  { code: "0014", name: "公假" },
  { code: "0015", name: "公傷假" },
  { code: "0016", name: "產假" },
  { code: "0017", name: "特休假" },
  { code: "0018", name: "陪產(檢)假" },
  { code: "0019", name: "補休假" },
  { code: "0020", name: "產檢假" },
  { code: "0022", name: "無薪病假(時)" },
  { code: "0023", name: "彈性假" },
  { code: "0024", name: "特准半薪病假" },
  { code: "0026", name: "家庭照顧假" },
  { code: "0027", name: "半薪生理假" },
  { code: "0028", name: "全薪流產假" },
  { code: "0029", name: "半薪流產假" },
  { code: "0031", name: "無薪病假(天)" },
  { code: "0033", name: "特准事假" },
  { code: "0034", name: "刷卡遲到" },
  { code: "0035", name: "刷卡早退" },
  { code: "0036", name: "例假" },
  { code: "0038", name: "公傷假(天)" },
  { code: "0039", name: "曠職" },
  { code: "0040", name: "教育訓練假" },
  { code: "0041", name: "颱風豪雨假" },
  { code: "0042", name: "選舉假" },
  { code: "0043", name: "國定假日假" },
  { code: "0044", name: "颱風豪雨假(不扣薪)" },
  { code: "0045", name: "內部會議假" },
  { code: "0046", name: "原住民祭儀假" },
  { code: "0047", name: "休息日" },
  { code: "0048", name: "無薪生理假" },
  { code: "0049", name: "防疫假(有薪)" },
  { code: "0050", name: "防疫假(無薪)" },
  { code: "0051", name: "特別補休假" },
  { code: "0052", name: "遲到/早退(SK)" },
  { code: "0053", name: "婚假(天)(SK)" },
  { code: "0054", name: "公傷假(半薪)(時)(SK)" },
  { code: "0090", name: "系統使用的假" },
  { code: "0091", name: "家庭照顧假(扣事假用)" },
  { code: "0092", name: "半薪生理假(扣病假用)" }
];

const DEFAULT_STATE = {
  role: "manager",
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selected: { type: null, id: null },
  deptFilter: "all",
  tableView: "member",
  tableDeptScopeFilter: "all",
  tableStatsVisible: true,
  scheduleStartDate: "",
  departments: [],
  positions: [],
  members: [],
  shifts: [],
  leaves: [],
  overtime: [],
  holidays: [],
  rules: {
    maxConsecutiveWorkDays: 6,
    weekStart: 0,
    monthStartDay: 1,
    eightWeekStartDate: ""
  },
  schedule: {},
  scheduleLoadedRanges: []
};

const ROLE_OPTIONS = [
  { value: "admin", label: "管理員" },
  { value: "manager", label: "主管" },
  { value: "employee", label: "員工" }
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
const WEEK_START_OPTIONS = [
  { value: 0, label: "星期日" },
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" }
];
const REST_WEEKDAY_OPTIONS = [
  { value: 1, label: "週一" },
  { value: 2, label: "週二" },
  { value: 3, label: "週三" },
  { value: 4, label: "週四" },
  { value: 5, label: "週五" },
  { value: 6, label: "週六" },
  { value: 0, label: "週日" }
];

const SCHEDULE_HISTORY_LIMIT = 20;

function createAttendanceState() {
  return { saving: false, error: "" };
}

function createMealOrderState() {
  return { loading: false, status: null, error: "" };
}

function resetLoadedUserRuntimeState() {
  currentMember = null;
  attendanceState = createAttendanceState();
  mealOrderState = createMealOrderState();
  recordsState = createRecordsState();
  appInfo = null;
}

function createRecordsState() {
  const today = getTodayDateString();
  return {
    loading: false,
    activeTab: "personal",
    personal: [],
    personalFilters: { fromDate: addDaysToDateString(today, -49), toDate: today },
    personalPage: 1,
    personalTotal: 0,
    personalPageSize: 50,
    mealStats: null,
    mealFilters: { fromDate: today, toDate: today, departmentId: "", memberId: "" },
    attendanceReview: {
      loading: false,
      rows: [],
      members: [],
      issueTypes: [],
      total: 0,
      page: 1,
      pageSize: 50,
      filters: {
        status: "unreviewed",
        fromDate: addDaysToDateString(today, -30),
        toDate: today,
        memberId: "",
        issueType: ""
      },
      error: ""
    },
    mealAdmin: { loading: false, products: [], settings: { daily_cutoff_time: "10:30" }, error: "" },
    error: ""
  };
}
