# 文件上传调试指南

## 问题诊断

文件上传后为空的完整流程检查已实现。请按以下步骤调试：

### 1️⃣ 上传流程检查
- **客户端上传日志**：打开浏览器开发者工具（F12），在 Console 查看：
  ```
  === [CLIENT UPLOAD START] ===
  File name: xxx
  File type: xxx
  File size: xxx bytes
  [CLIENT] Upload successful, response data: {...}
  ```

- **服务器存储日志**：在终端查看 Wrangler 输出：
  ```
  [Upload] Received file: xxx, size: xxx bytes
  [Upload] ArrayBuffer size after conversion: xxx bytes
  [Upload] File stored in R2 with key: xxx
  [Upload] Verification - File exists in R2, size: xxx bytes
  ```

### 2️⃣ 关键检查点

#### 上传时检查
✅ 客户端报告的文件大小
✅ ArrayBuffer 转换后的大小（应该相同）
✅ R2 存储验证的大小（应该相同）

如果任何一个为 0，则在该环节出问题。

#### 下载时检查
✅ 浏览器开发者工具 → Network 标签
  - 点击下载文件链接
  - 查看请求 URL：`/files/timestamp-filename`
  - 查看响应 Content-Length（应该 > 0）
  - 查看响应状态码（应该是 200）

✅ 服务器日志应该显示：
  ```
  [Download] Requesting file with key: xxx
  [Download] File found, size: xxx bytes
  ```

### 3️⃣ 常见问题排查

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| 上传成功但下载为空 | R2 存储问题 | 检查 R2 bucket 凭证和权限 |
| ArrayBuffer 大小为 0 | 文件读取问题 | 检查浏览器文件 API |
| 404 File not found | /files 路由未实现 | 已实现，重新部署 |
| 显示 "Empty file" 错误 | 客户端上传空文件 | 检查上传的文件是否为空 |

### 4️⃣ 实际测试步骤

1. 在本地运行：
   ```bash
   wrangler dev
   ```

2. 打开浏览器 DevTools (F12)

3. 上传一个小测试文件（例如 1MB 的文本文件）

4. **检查 Console 中的所有日志**

5. **查看 Network 标签中的请求**

6. 尝试下载文件并检查大小

### 5️⃣ R2 配置验证

检查 `wrangler.json` 中的 R2 配置：
```json
"r2_buckets": [{
  "binding": "R2_BUCKET",
  "bucket_name": "cfchat-bucket"
}]
```

确保：
- ✅ Bucket 名称在 Cloudflare 仪表板中存在
- ✅ 已运行 `wrangler login`
- ✅ 已运行 `wrangler deploy` 或 `wrangler dev`

## 完整流程图

```
客户端上传
    ↓ (FormData)
/upload 端点
    ↓ (将 File 转为 ArrayBuffer)
R2 存储 (put)
    ↓ (返回 /files/key)
客户端接收 URL
    ↓ (用户点击下载)
/files/key 端点
    ↓ (从 R2 读取，get)
客户端下载
```

每个环节都有日志输出，帮助定位问题。
