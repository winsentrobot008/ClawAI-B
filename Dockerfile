FROM python:3.10-slim

WORKDIR /app

# 复制依赖描述文件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制全量瘦身后的源码
COPY . .

# 暴露后端 API 端口
EXPOSE 8000

# 启动命令：直接拉起 FastAPI 核心网关
CMD ["python", "-m", "livebench.api.server"]