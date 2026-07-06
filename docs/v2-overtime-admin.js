(() => {
  [
    "https://cdn.jsdelivr.net/gh/5871224/FYH@462bf7cdf97891d92a7b9021c8d138c0cdd01efa/src/renderer/v2-overtime-admin.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@ad0947f4ebdb3e6a3e167291a932d5e86939cf01/src/renderer/v2-account.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@a756bd83da38e391dcba65e1ecb30c45ec54fb10/src/renderer/v2-records.js"
  ].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = false;
    document.head.appendChild(script);
  });
})();
