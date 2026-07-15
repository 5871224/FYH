# API 公開通道

瀏覽器無法直連內網 Postgres。公開網域的前端必須透過 HTTPS 連到 Supabase API（Kong，通常 `:8000`）。

## 方案 A：Cloudflare Tunnel（推薦）

優點：不需在公司防火牆開 inbound port；可搭配 Cloudflare Access 限制只有公司帳號可進。

### 步驟

1. 在 Cloudflare 建立 Tunnel，取得 token
2. 在內網 Supabase 主機安裝 `cloudflared`
3. 複製 `cloudflared-config.example.yml` 為 `cloudflared-config.yml` 並修改網域
4. 執行：

```bash
cloudflared tunnel --config infra/tunnel/cloudflared-config.example.yml run
```

5. DNS：`api.schedule.company.com` CNAME 指向 tunnel
6. `.env` 設定 `SUPABASE_URL=https://api.schedule.company.com`

### 可選：Cloudflare Access

在 Zero Trust 為 `schedule.company.com`（前端）與 `api.schedule.company.com`（API）建立 Access policy，限制公司 Google / Microsoft 帳號。

## 方案 B：Nginx 反向代理（DMZ）

若公司有 DMZ 主機，可用 `nginx-api.conf.example`：

- TLS 在 Nginx 終止（Let's Encrypt 或公司憑證）
- 轉發到內網 `http://SUPABASE_INTERNAL_IP:8000`
- Postgres 5432 不對 DMZ / 外網開放

## 安全提醒

- Supabase Network Restrictions **只限制 Postgres 5432**，不限制 PostgREST / Auth HTTPS API
- 公開網域部署請套用 `018_tighten_anon_read_policies.sql`
- `sb_publishable_...` 可放在前端，但 `sb_secret_...` 絕不可 commit
