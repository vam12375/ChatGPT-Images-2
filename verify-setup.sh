#!/bin/bash
# 反向代理快速验证脚本

echo "🚀 ChatGPT 反向代理系统 - 快速验证"
echo "=================================="
echo ""

# 检查 Node.js 环境
echo "1️⃣  检查 Node.js 环境..."
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js 未安装"
    exit 1
fi

echo ""
echo "2️⃣  检查必要文件..."
files=(
    "src/lib/proxy-config.js"
    "src/lib/proxy-middleware.js"
    "src/lib/proxy-handler.js"
    "src/app/api/proxy/stats/route.js"
    ".env.local"
    "QUICKSTART.md"
    "PROXY_GUIDE.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (缺失)"
    fi
done

echo ""
echo "3️⃣  检查环境变量..."
if grep -q "OPENAI_API_KEY" .env.local; then
    echo "✅ .env.local 已配置 OPENAI_API_KEY"
    # 检查是否填充了值（不显示真实值）
    if grep "OPENAI_API_KEY=sk-" .env.local > /dev/null; then
        echo "✅ API 密钥已设置"
    else
        echo "⚠️  API 密钥格式检查: 确保以 sk- 开头"
    fi
else
    echo "❌ 缺少 OPENAI_API_KEY"
fi

echo ""
echo "4️⃣  推荐的下一步..."
echo ""
echo "   启动服务:"
echo "   $ npm run dev"
echo ""
echo "   测试反向代理:"
echo "   $ curl http://localhost:3000/api/proxy/stats"
echo ""
echo "   查看文档:"
echo "   $ cat QUICKSTART.md"
echo ""
echo "=================================="
echo "✨ 快速验证完成！"
