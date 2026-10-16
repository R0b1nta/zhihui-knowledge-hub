# 在现有阿里云服务器上试运行

当前目标：新加坡、2 核、1 GB 内存、30 GB 系统盘，已有 WordPress 镜像。以下是部署步骤，不代表已完成远程安装。

## 1. 部署前确认

先做服务器快照，查看操作系统、现有 WordPress 是否有需保留的数据、80 / 443 / 3100 端口占用情况。不要重置系统，不要覆盖原 WordPress 的 Web 配置。

第一阶段使用 `http://服务器公网IP:3100` 浏览公开内容。必须先部署并放行端口，此地址才可访问。未配置 HTTPS 时，项目登录保持关闭。

## 2. 安装并上传

使用官方渠道安装 Node.js 24 或更新版本，确认 `node --version`。参考服务文件假设 Node 在 `/usr/bin/node`，如果实际路径不同需修改 `ExecStart`。需要 `node:sqlite` 内置模块，不需要额外数据库、Redis 或 npm 依赖。

上传本项目源码到 `/opt/cimai-knowledge-hub`，不上传本机的 `data/`、测试数据或备份。创建专用运行用户和数据目录：

```sh
sudo useradd --system --home /var/lib/cimai --shell /usr/sbin/nologin cimai
sudo install -d -m 700 -o cimai -g cimai /var/lib/cimai
```

源码由管理员持有，运行用户只需要读取源码；数据写入 `/var/lib/cimai`。目录需允许 cimai 用户读取和进入。

## 3. 启动公开试运行

确认服务文件的 Node 路径正确后：

```sh
sudo cp deploy/cimai.service /etc/systemd/system/cimai.service
sudo systemctl daemon-reload
sudo systemctl enable --now cimai
sudo systemctl status cimai
```

在阿里云轻量服务器“防火墙”与系统防火墙中放行 TCP 3100。保留现有 WordPress 使用的端口；无需开放数据库端口。手机使用移动网络访问公网试运行地址，验证首页、文章、搜索、项目入口提示。

服务默认 `SESSION_SECURE=1`，公网 HTTP 下 `/api/login` 和项目接口会拒绝请求。请勿为公网服务设为 0。

如需在购买域名前测试员工功能，可仅通过 SSH 本地转发访问一个绑定 `127.0.0.1`、`SESSION_SECURE=0` 的独立测试实例；不要让测试实例直接对公网监听。正式数据库和测试数据库应分开。

## 4. 配置域名并开放员工登录

购买域名后：

1. 把域名 A 记录指向服务器公网 IPv4。
2. 配置有效的 HTTPS 证书与续期。不要仅修改页面地址冒充 HTTPS。
3. 检查 WordPress 实际使用 Nginx 还是 Apache，再为新域名单独添加反向代理站点；`deploy/nginx-domain.conf.example` 仅供现有 Nginx 环境参考。不要为此直接安装第二个占用相同端口的 Web 服务。
4. 代理转发至 `127.0.0.1:3100`，覆写 Host、X-Forwarded-Proto、X-Real-IP 请求头。
5. 将 systemd 服务的 HOST 改为 `127.0.0.1`，重启应用；关闭公网 3100，仅保留网站需要的 80 / 443。管理连接端口按实际管理需要限制来源。
6. 创建管理员：

```sh
sudo -u cimai env DATA_DIR=/var/lib/cimai /usr/bin/node /opt/cimai-knowledge-hub/scripts/create-admin.mjs
```

7. 用 `https://你的域名` 登录，在“内容与账号”中开通员工账号。检查访客不能读取项目接口，退出后不能继续访问项目。

新加坡节点按阿里云当前说明不需要接入 ICP 备案；以后迁移到中国内地节点前需办理相应备案。中国内地员工应实际测试跨境访问速度。

## 5. 备份和更新

```sh
sudo -u cimai env DATA_DIR=/var/lib/cimai BACKUP_DIR=/var/lib/cimai/backups /usr/bin/node /opt/cimai-knowledge-hub/scripts/backup.mjs
```

每天执行备份并复制到私密的异机位置，定期验证恢复。更新时先备份，替换源文件并重启服务，保留数据目录。查看错误：`sudo journalctl -u cimai -n 80 --no-pager`。

参考官方说明：

- [轻量服务器使用须知](https://help.aliyun.com/zh/simple-application-server/product-overview/usage-notes)
- [WordPress 环境部署 SSL 证书](https://help.aliyun.com/zh/simple-application-server/use-cases/install-an-ssl-certificate-in-a-wordpress-environment-that-runs-linux)

目前不需要另购数据库、付费建站系统或 CDN。是否升级内存，取决于与现有 WordPress 同时运行时的实际使用情况。
