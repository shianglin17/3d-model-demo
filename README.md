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
- `GET /api/model`：取得最新一筆模型的 UID。

範例：
```bash
curl -X POST http://localhost:3000/api/import/模型UID
curl http://localhost:3000/api/models
```
