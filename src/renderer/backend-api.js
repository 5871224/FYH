(function installBackendApiFacade() {
  if (window.schedulerApi?.__backendFacade === true) {
    return;
  }

  const provider = window.schedulerApi;
  if (!provider || typeof provider !== "object") {
    throw new Error("缺少後端服務提供者");
  }

  window.schedulerBackendProvider = provider;

  const facade = {};
  for (const [name, value] of Object.entries(provider)) {
    facade[name] = typeof value === "function" ? value.bind(provider) : value;
  }

  Object.defineProperty(facade, "__backendFacade", {
    value: true,
    enumerable: false
  });

  Object.defineProperty(window, "schedulerApi", {
    value: Object.freeze(facade),
    configurable: true,
    enumerable: true,
    writable: true
  });
})();
