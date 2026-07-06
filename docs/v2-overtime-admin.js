(() => {
  [
    "https://cdn.jsdelivr.net/gh/5871224/FYH@462bf7cdf97891d92a7b9021c8d138c0cdd01efa/src/renderer/v2-overtime-admin.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@87ac3325d1b4574556b9ad5afa52c4b73cde64c0/src/renderer/v2-meal.js"
  ].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = false;
    document.head.appendChild(script);
  });
})();
