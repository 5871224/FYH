(() => {
  [
    "https://cdn.jsdelivr.net/gh/5871224/FYH@462bf7cdf97891d92a7b9021c8d138c0cdd01efa/src/renderer/v2-overtime-admin.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@87ac3325d1b4574556b9ad5afa52c4b73cde64c0/src/renderer/v2-meal.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@52f038ca57570ff8b1d4bce1daf5d4e664a90771/src/renderer/v2-account.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@93370b20954f42d28f0c2666e071d36bf75bd961/src/renderer/v2-attendance-admin.js"
  ].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = false;
    document.head.appendChild(script);
  });
})();
