(() => {
  [
    "https://cdn.jsdelivr.net/gh/5871224/FYH@462bf7cdf97891d92a7b9021c8d138c0cdd01efa/src/renderer/v2-overtime-admin.js",
    "https://cdn.jsdelivr.net/gh/5871224/FYH@52f038ca57570ff8b1d4bce1daf5d4e664a90771/src/renderer/v2-account.js"
  ].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = false;
    document.head.appendChild(script);
  });
})();
