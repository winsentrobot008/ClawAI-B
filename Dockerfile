FROM python:3.10-slim

WORKDIR /app

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖描述文件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制全量源码
COPY . .

# 构建前端
RUN cd frontend && npm install && npm run build && cd ..

# 暴露后端 API 端口
EXPOSE 8000

# 启动命令：FastAPI 网关（同时提供 API + 构建好的前端页面）
CMD ["python", "-m", "livebench.api.server"]