FROM python:3.10-slim

WORKDIR /app

# 仅安装 Python 基础依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制全量源码（汉化修改和本地生成的 agent 数据会一起被带过去）
COPY . .

EXPOSE 8000

# 统一入口启动 — FastAPI 常驻 Web 服务
CMD ["python", "-m", "livebench.api.server"]
