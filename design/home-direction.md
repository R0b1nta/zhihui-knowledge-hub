# 磁脉山海首页

2026-10-26，参考用户提供的山峦云海与白色字标截图，为磁脉制作独立的首页表达。不使用 Kimi 的标志、品牌文案或界面素材。

## 视觉与交互

- 色彩：山峦蓝 `#203d47`、深海蓝 `#193540`、雾白 `#f8faf6`、冷灰 `#eff3f2`、岩灰 `#61767a`。
- 字体：中文标题使用设备上的宋体系列；正文使用系统黑体；英文 Cimai 使用 Georgia。没有外部字体请求。
- 构图：全屏图片与居中字标；顶端轻导航；底端探索提示。向下进入可切换技术方向、近期公开文章和员工项目入口。
- 克制：不用虚构案例、客户名单、实验数字或认证；技术图形标注“概念示意”。技术切换分别说明充退磁、电磁制造和特种线圈，不重复堆叠营销卡片。
- 动效：背景图缓慢推进、两层浅雾漂移、一次文字入场与轻微滚动景深。暂停按钮控制持续动效，遵循减少动态效果设置；首屏离开视口时暂停背景运动；路由离开时清理监听。
- 文库和文章继续使用既有左侧导航；首页入口链接使用现有文章、搜索和项目路由。

## 图片来源

使用内置 image_gen 生成新图，随后仅转换为 JPEG 以减小网站传输体积。最终资产：`public/assets/cimai-mountains.jpg`，1672 × 941，约 223 KiB。运行时不调用图像生成或模型接口。

最终生成提示词：

> Create a cinematic photographic website background, landscape 16:9, high resolution. A majestic range of jagged slate-blue mountains emerging from a deep ocean of luminous white and pale blue mist. A dark dramatic ridgeline enters from the left bottom third and a separate closer peak occupies the lower right corner; distant smaller ridgelines recede across the middle. Clouds flow between peaks with believable volumetric light. Pale overcast dawn sky with soft warm silver light at the top, cool desaturated teal/slate atmosphere below. Rich, realistic natural texture, slightly ethereal cinematic film grading, restrained contrast, sophisticated Chinese landscape mood, calm and monumental. The center should be mostly soft cloud and distant mountains with ample quiet negative space for a white brand wordmark overlaid later in HTML. Compose the tallest near mountains to the sides, keep the very middle open. Absolutely NO text, NO letters, NO logos, NO watermark, NO interface, NO buildings, NO people, NO abstract ribbons, no neon. The image is an atmospheric brand hero for a Chinese electromagnetic manufacturing and technical knowledge company named Cimai; the image itself must contain no typography.

实现为图片加 CSS 动效，是对截图氛围的原创实现；尚无原演示网址，因此不声称复现原站的视频、三维场景或滚动动画。


0.4.0 已对照用户补充的原演示网址进行第二轮全站调整，详见 [全站设计借鉴记录](site-reference-notes.md)。本文件保留首轮背景图的生成来源与提示词。
