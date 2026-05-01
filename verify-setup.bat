@echo off
REM 反向代理快速验证脚本（Windows 版本）

echo.
echo 🚀 ChatGPT 反向代理系统 - 快速验证
echo ==================================
echo.

REM 检查 Node.js 环境
echo 1️⃣  检查 Node.js 环境...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js: %NODE_VERSION%
) else (
    echo ❌ Node.js 未安装
    exit /b 1
)

echo.
echo 2️⃣  检查必要文件...
set files=^
    src\lib\proxy-config.ts^
    src\lib\proxy-middleware.ts^
    src\lib\proxy-handler.ts^
    src\app\api\proxy\stats\route.ts^
    .env.local^
    docs\QUICKSTART.md^
    docs\PROXY_GUIDE.md

for %%f in (%files%) do (
    if exist "%%f" (
        echo ✅ %%f
    ) else (
        echo ❌ %%f (缺失)
    )
)

echo.
echo 3️⃣  检查环境变量...
findstr /C:"OPENAI_API_KEY" .env.local >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ .env.local 已配置 OPENAI_API_KEY
    findstr /C:"OPENAI_API_KEY=sk-" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ API 密钥已设置
    ) else (
        echo ⚠️  API 密钥格式检查: 确保以 sk- 开头
    )
) else (
    echo ❌ 缺少 OPENAI_API_KEY
)

echo.
echo 4️⃣  推荐的下一步...
echo.
echo    启动服务:
echo    $ npm run dev
echo.
echo    测试反向代理:
echo    $ curl http://localhost:3000/api/proxy/stats -H "Authorization: Bearer ^<PROXY_ADMIN_TOKEN^>"
echo.
echo    查看文档:
echo    $ type docs\QUICKSTART.md
echo.
echo ==================================
echo ✨ 快速验证完成！
echo.
pause
