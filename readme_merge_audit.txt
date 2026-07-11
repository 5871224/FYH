# README 整併盤點

## package.json scripts
- web: node src/web-server.js
- web:check: node scripts/check-public-supabase.js
- web:publish: node scripts/publish-static-web.js
- v2:check: node scripts/check-v2-alignment.js && node scripts/check-v2-final.js

## Supabase Edge Function 目錄
- attendance-admin-action-v2
- attendance-admin-list-v2
- attendance-clock
- attendance-clock-safe
- attendance-overtime
- attendance-overtime-admin-action
- attendance-overtime-admin-list
- attendance-overtime-employee
- catalog-admin
- department-attendance-v2
- meal-cancel-v2
- meal-order
- meal-report-v2
- member-auth-admin
- member-auth-admin-v2
- member-delete-v2
- member-order-v2
- personal-records-v2
- report-records

## deploy-v2-final.ps1 部署清單
- member-auth-admin
- catalog-admin
- report-records
- attendance-clock
- attendance-clock-safe
- meal-order
- attendance-overtime-employee
- attendance-overtime-admin-list
- attendance-overtime-admin-action
- attendance-admin-list-v2
- attendance-admin-action-v2
- department-attendance-v2
- member-delete-v2
- member-order-v2
- personal-records-v2
- meal-report-v2
- meal-cancel-v2

## 清單差異
- 目錄存在但部署腳本未列出：attendance-overtime, member-auth-admin-v2
- 部署腳本列出但目錄不存在：無

## supabase/README.md 引用位置
- AGENTS.md

## 規格書關鍵內容存在狀況
- 001_current_schema.sql: 無
- 002_current_updates.sql: 無
- schedule_entries: 有
- save_schedule_entries_bulk: 有
- save_attendance_clock: 有
- attendance_records: 有
- attendance_action_logs: 有
- attendance_overtime_requests: 有
- overtime_review_logs: 有
- meal_products: 有
- meal_settings: 有
- meal_orders: 有
- leave_requests: 無
- overtime_requests: 有
- clock_locations: 有
- attendance_logs: 有
- 固定 IP: 有
- 原始 GPS: 有
- 安全 RPC: 無
- Edge Functions: 有

## 根 README 標題
- # 排班系統
- ## 主要功能
- ## 規格書摘要
- ## 專案結構
- ## 常用指令
- ## GitHub Pages 發佈
- ## 目前儲存模型
- ## 自動排班與自動補班
- ## 驗證

## Supabase README 標題
- # Supabase 資料庫
- ## 檔案用途
- ### `001_current_schema.sql`
- ### `002_current_updates.sql`
- ## 目前資料模型
- ## 正式資料表
- ## 已淘汰物件
- ## 維護規則

## AGENTS 標題
- # AI 開發代理人注意事項
- ## 開始處理前
- ## 編碼與語言
- ## 修改與發布規則
- ## 修改時的檔案檢查
- ## 驗證原則
