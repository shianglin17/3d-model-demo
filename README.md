## Sketchfab + Mongo Demo（Docker 版）

### 下載與啟動
```bash
cp .env.example .env
docker compose up --build
# 打開：http://localhost:3000
```

### 使用方式
- 輸入 Sketchfab 模型 UID，按「匯入」→ 儲存到 Mongo 並在右側顯示。
- 按「載入最新」→ 顯示最近匯入的一筆。
- 點列表中的 UID → 載入該模型。

### 基本 API
- `POST /api/import/:uid`：從 Sketchfab 取得模型並 upsert 到 `modeldocs`。
- `GET /api/models`：取得全部模型（依更新時間降冪）。
- `GET /api/models/:uid`：取得指定 UID 的模型。
- `DELETE /api/models/:uid`：刪除指定模型
- `GET /api/model`：取得最新一筆模型的 UID。

### API 限流功能
為了防止濫用，所有 API 請求都受到限流保護：

- **允許網域**：來自 `https://3d-model.aaronlei.com/` 的請求不受限制
- **外部請求**：其他來源的 IP 每天最多允許 5 次請求
- **限流統計**：`GET /api/rate-limit-stats` 可查看當前限流狀態

當超過限制時，API 會返回 429 狀態碼和中文錯誤訊息。

範例：
```bash
# 正常請求
curl -X POST http://localhost:3000/api/import/模型UID

# 查看限流統計
curl http://localhost:3000/api/rate-limit-stats

# 測試限流功能
node test-rate-limit.js
```
