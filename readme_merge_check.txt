normalized storage checks passed
expansion acceptance checks passed

> shift-scheduler-desktop@1.0.0 v2:check
> node scripts/check-v2-alignment.js && node scripts/check-v2-final.js

V2 alignment checks passed (18 required files).
/home/runner/work/FYH/FYH/scripts/check-v2-final.js:9
  if (!condition) throw new Error(message);
                  ^

Error: 規格書未明確標示員工可查看完整班表
    at assert (/home/runner/work/FYH/FYH/scripts/check-v2-final.js:9:25)
    at Object.<anonymous> (/home/runner/work/FYH/FYH/scripts/check-v2-final.js:211:1)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
    at node:internal/main/run_main_module:36:49

Node.js v22.23.1
validation_status=1
