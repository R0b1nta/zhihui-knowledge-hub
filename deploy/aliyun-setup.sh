#!/bin/bash
# 磁脉知识库 —— 阿里云服务器一键安装脚本
# 用法（在服务器上以 root 或 sudo 执行）：
#   sudo bash aliyun-setup.sh
# 前提：已做服务器快照；本脚本不会改动现有 WordPress 配置。

set -euo pipefail

APP_DIR=/opt/cimai-knowledge-hub
DATA_DIR=/var/lib/cimai
REPO=https://github.com/R0b1nta/zhihui-knowledge-hub.git
NODE_VER=v24.21.0

echo "==> 1/6 安装 Node.js ${NODE_VER}（官方二进制，不动系统包管理器）"
if ! /usr/bin/node --version 2>/dev/null | grep -q '^v2[4-9]'; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  NODE_ARCH=x64 ;;
    aarch64) NODE_ARCH=arm64 ;;
    *) echo "不支持的架构: $ARCH"; exit 1 ;;
  esac
  cd /tmp
  curl -fsSLO "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NODE_ARCH}.tar.xz"
  tar -xJf "node-${NODE_VER}-linux-${NODE_ARCH}.tar.xz" -C /usr/local --strip-components=1
  ln -sf /usr/local/bin/node /usr/bin/node
  rm -f "node-${NODE_VER}-linux-${NODE_ARCH}.tar.xz"
fi
node --version

echo "==> 2/6 创建运行用户和数据目录"
id cimai &>/dev/null || useradd --system --home ${DATA_DIR} --shell /usr/sbin/nologin cimai
install -d -m 700 -o cimai -g cimai ${DATA_DIR}

echo "==> 3/6 拉取代码到 ${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C ${APP_DIR} pull --ff-only
elif command -v git &>/dev/null; then
  git clone ${REPO} ${APP_DIR}
else
  # 没有 git 时直接下载 GitHub 打包好的源码
  mkdir -p ${APP_DIR}
  curl -fsSL "https://codeload.github.com/R0b1nta/zhihui-knowledge-hub/tar.gz/refs/heads/main" \
    | tar -xz -C ${APP_DIR} --strip-components=1
fi
# 运行用户 cimai 需要读取源码：保持 root 持有，放开读与进入权限（不含写）
chmod -R o+rX ${APP_DIR}

echo "==> 4/6 安装 systemd 服务并启动"
cp ${APP_DIR}/deploy/cimai.service /etc/systemd/system/cimai.service
systemctl daemon-reload
systemctl enable --now cimai
sleep 2
systemctl --no-pager --full status cimai | head -12 || true

echo "==> 5/6 本机自测"
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3100/ \
  && echo "应用已在 127.0.0.1:3100 正常响应" \
  || { echo "应用未响应，查看日志: journalctl -u cimai -n 80 --no-pager"; exit 1; }

echo "==> 6/6 系统防火墙放行 3100（如存在）"
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q active; then
  ufw allow 3100/tcp
elif command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port=3100/tcp && firewall-cmd --reload
else
  echo "未发现 ufw/firewalld，跳过（iptables 默认放行则无需操作）"
fi

cat <<'EOF'

✅ 安装完成。还差最后一步，必须在阿里云控制台做：

   轻量应用服务器控制台 → 你的实例 → 防火墙 → 添加规则：
   协议 TCP，端口 3100。

然后用手机移动网络访问验证：
   http://服务器公网IP:3100

注意：
- 当前为公开试运行，员工登录已按设计关闭（需域名 + HTTPS 后开放）。
- 不要创建测试账号到正式库；域名就绪后再跑 scripts/create-admin.mjs。
- 每天备份：sudo -u cimai env DATA_DIR=/var/lib/cimai BACKUP_DIR=/var/lib/cimai/backups \
    /usr/bin/node /opt/cimai-knowledge-hub/scripts/backup.mjs
EOF
