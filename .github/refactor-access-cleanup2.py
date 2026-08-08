from pathlib import Path

p = Path('src/renderer/web-api.js')
t = p.read_text(encoding='utf-8')
start = t.index('async function getAttendanceReviewList')
end = t.index('async function getMemberOrder', start)
canonical = '''async function getAttendanceReviewList(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_list", ...filters });
  }

  async function saveAttendanceReviewRecord(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_save", ...payload });
  }

  async function setAttendanceReviewed(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_set", ...payload });
  }

  async function getAttendanceHistory(recordId) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "history", recordId });
  }

  '''
t = t[:start] + canonical + t[end:]
p.write_text(t, encoding='utf-8')
print('web api explicit attendance region cleaned')
