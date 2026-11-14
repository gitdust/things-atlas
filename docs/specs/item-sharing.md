# 单条内容分享技术方案

状态：提案，未实施  
日期：2026-11-14  
范围：Things Atlas 单个条目的链接分享、知识海报、社交预览

## 1. 目标与边界

用户在物品详情中，用少量操作复制条目链接、保存知识海报，或通过系统分享面板发送链接/图片。接收者通过链接或二维码打开对应语言的原条目。

V1 包含：一个分享弹窗、一套固定视觉模板、中文和英文各自的海报、独立 OG 预览图、可复制链接、保存图片，以及能力允许时的系统分享。

V1 不包含：用户编辑文案、主题选择、地图截图、游戏战绩、账号、服务端实时制图、微信 JS SDK、平台自动发帖。不会承诺某平台必然显示 OG 卡片或支持直接分享。

## 2. 已核查的项目基础

| 文件 | 现状 / 接入点 |
| --- | --- |
| src/components/ItemDrawer.tsx | 已有分享按钮；支持 navigator.share，缺失时复制链接 |
| src/lib/seo.ts | itemPath、absoluteUrl、双语元数据；运行时尚未同步社交图片 |
| scripts/prerender.ts | 静态中英页面、OG/Twitter 标签；有图条目使用原图，无图使用通用 OG 图 |
| src/lib/types.ts | 已有 summary、years、precision、disputed、sources、图片署名等字段 |
| worker/index.ts | 英文、西语、日语公开 URL 为 `/en/`、`/es/`、`/ja/`；旧 `?lang=` 301 到对应路径 |
| src/components/VersionControl.tsx | 可参考现有原生 dialog 模式 |

项目不需要新增公开条目路由。公开英文 URL 保持现状，二维码不得指向内部 /en 路径。

## 3. 用户交互

### 3.1 入口与布局

详情顶部现有分享按钮改为打开分享弹窗；不新增首页按钮。弹窗继承站点纸张底色、字体与强调色，图片本身采用固定浅色主题，不随系统主题变化。

从上到下：标题「分享条目 / Share entry」、中/EN 切换、竖版海报预览、操作区、只读链接。默认使用当前界面语言；弹窗内切换只影响分享内容，不改变主页面语言和地址。

常驻操作为「复制链接」「保存图片」。支持系统分享时额外显示「系统分享」菜单，明确选择链接或图片；不放多个社交平台图标。桌面弹窗限制最大高度并内部滚动；窄屏纵向排列，所有操作可触达。

### 3.2 状态与异常

- 弹窗打开即获取当前条目/语言对应海报；加载期间显示占位，复制链接始终可用。
- 图片准备完成后启用保存与图片分享。图片加载失败显示重试，仍可分享链接。
- 复制失败时保留可选中链接并提示手动复制，不弹浏览器 alert。
- 保存成功只能提示「已开始下载」，不能声称已保存进相册。
- 系统分享 AbortError 作为取消处理；其他错误提示重试或保存图片，不自动触发另一个分享动作。
- 语言切换、条目变更和关闭时取消旧请求；使用请求标识防止旧结果覆盖当前预览。
- Esc 关闭，焦点返回原分享按钮；弹窗打开时地图、时间轴及条目切换快捷键不得穿透。
- 加载、复制、错误信息通过 role=status 宣读；按钮有明确 accessible name。

## 4. 两种图片产物

| 类型 | 尺寸 / 格式 | 内容 | 使用位置 |
| --- | --- | --- | --- |
| 知识海报 | 1080 × 1440 PNG | 名称、物品图、简史、关键节点、来源提示、署名、二维码 | 弹窗预览、下载、系统图片分享 |
| 社交预览 | 1200 × 630 JPEG | 名称、物品图、短摘要、品牌、必要署名 | og:image、twitter:image |

两个版式共享数据和视觉 token，但分别排版；不把竖图直接裁成横图。OG 图不放二维码，点击卡片本身即可访问。每个条目生成两种语言、两种尺寸，总数为条目数 × 4。

海报版式：上方品牌和条目名称，中部完整物品图（object-fit: contain），下方历史摘要与最多三个节点，底部来源/图片署名及二维码。二维码建议成图边长 200px，黑白、保留四模块静区、不加 Logo；最终以实机识别为准。没有合规图片时使用文字版，保留同一视觉体系。

中文海报以中文为主，可保留英文名称作小字；英文海报以英文为主。不可把两段完整双语说明塞进同一张图。

## 5. 内容规则

### 5.1 准确性

- 优先复用当前语言 summary 和已审核的年份说明，不在构建时调用模型生成事实。
- 不把 primary_year 一律标为「发明于」。展示年份必须绑定事件名称、说明与 precision。
- invention 字段也不自动代表确切发明日期；记载、考古发现、专利、商业化必须分别表述。
- 年代精度为 decade / century 时用「约 / c.」等明确表达；不制造月日精度。
- disputed=true 时海报必须出现「起源存在争议 / Origins disputed」，不可隐藏以追求简洁。
- 时间节点按真实年份排列；不假设专利一定先于量产或普及。
- 某语言缺少必需内容时构建报出条目和字段，不静默混入另一语言。

卫生纸示例采用「约 589 年已有用纸如厕的记载」，不能采用「589 年发明了卫生纸」。

### 5.2 可选编辑字段

允许在条目 JSON 增加可选 share 字段，并同步 JSON Schema 和类型。用于文本过长或历史口径需要人工校正的条目，不强制全量复制 summary。

```ts
type ShareEditorial = {
  zh: { summary: string; ogSummary: string; milestones?: ShareMilestone[] };
  en: { summary: string; ogSummary: string; milestones?: ShareMilestone[] };
};
type ShareMilestone = {
  yearKey: YearKey; // 年份和精度从原 years 对应记录读取
  label: string;   // 例如「使用记载」，不是强制写成「发明」
  text: string;
};
```

没有编辑字段时海报复用完整 summary；OG 用同一摘要，允许省略号截断非关键补充信息，但不得截断争议/约数限定。默认节点取 primary 所在事件及其余有效事件，去重、按时间排序、最多三个；事件说明无法可靠缩短时仅保留摘要，不生成误导节点。

### 5.3 排版校验

名称、摘要、节点、署名分别设置固定区域。以浏览器实测尺寸判断溢出，不以字符串长度代替。提供有限字号档位和有限行数；仍溢出则构建失败并要求编辑短文案，不无限缩字、不截断重要限定信息。

### 5.4 来源与图片授权

海报展示主要来源名称及「完整来源见条目」；二维码链接回含完整来源的页面。数据标注 Things Atlas · CC BY 4.0，并提供许可入口。

图片单独处理 credit、license、source_url，不把数据许可套用到图片。第一版优先使用可确认的 CC0 / 公有领域素材；其他许可须确认导出图片中的署名、许可名称/链接及改动说明能满足要求。信息缺失或版面无法容纳必要署名时，自动采用无图模板并输出构建警告。通用品牌图也只能引用已确认可再分发的素材。

## 6. 技术架构

采用构建时 HTML/CSS 排版 → Chromium 截图 → 静态图片。线上仅下载图片，不运行渲染服务，不读取 WebGL canvas，不依赖地图瓦片。

### 6.1 模块职责

| 新增 / 修改 | 职责 |
| --- | --- |
| src/lib/share.ts | 纯函数：规范分享 URL、内容选择、语言及事件映射 |
| scripts/share/template.tsx | 构建专用 React 海报/OG 模板 |
| scripts/share/style.css | 固定图片版式和字体，复用必要设计 token |
| scripts/build-share-images.ts | 内容校验、二维码、截图、压缩、manifest |
| src/generated/share-manifest.json | 浏览器及预渲染共同使用的资源索引 |
| src/components/ShareDialog.tsx | 预览、切换语言、复制、下载、系统分享 |
| src/components/ItemDrawer.tsx | 将现有分享入口接到弹窗 |
| src/lib/seo.ts | 统一读取条目图片元数据，运行时同步图片 URL / 尺寸 / alt |
| scripts/prerender.ts | 构建 HTML 使用同一 manifest，包括本地化 alt |

manifest、图片作为生成产物加入 ignore；编辑文案和模板进入 Git。建议增加 Playwright 和二维码生成包作为开发依赖，沿用 sharp 压缩图片；不将截图和二维码依赖加入浏览器 bundle。具体包版本在实施时锁定并核查官方 API。

### 6.2 构建顺序

数据/字体验证 → build:data → build:share → 前端打包 → 页面预渲染 → 资源关联检查。

生成器使用本地 HTTP 服务提供模板、字体、图片；只绑定 loopback，禁止渲染过程中加载外部网络资源。等待 document.fonts.ready 和图片 decode 完成，固定浏览器版本、viewport、deviceScaleFactor、语言及时区，关闭动画后截取卡片元素。

沿用现有中文/英文字体，确认分享文案所有字符包含在字体覆盖内；如需扩充字体收集器，将 share 字段加入扫描。字体或图片未就绪不能输出半成品。

开发环境先准备 manifest；首次生成可耗时，后续按 hash 增量生成。开发命令也必须保证文件存在，不能让首次 checkout 出现 missing import。CI 需安装匹配的 Chromium 及运行依赖，不依赖开发者机器上的浏览器。

### 6.3 文件与缓存

```text
/share/<item-id>/zh-poster.<hash>.png
/share/<item-id>/en-poster.<hash>.png
/share/<item-id>/zh-og.<hash>.jpg
/share/<item-id>/en-og.<hash>.jpg
```

hash 覆盖内容、语言、图片字节、字体、模板/CSS、生成器版本、正式站点 origin。manifest 每条包含 poster / og 的 URL、尺寸、MIME 和 alt。hash 文件可使用长期 immutable 缓存；HTML 按现有更新策略，不能长时间缓存旧 manifest 引用。

构建产物图片可先生成到 public/share 供 Vite 复制，开发和生产共用同一路径。每次完整构建清理过期产物；部署原子发布。若无法保留历史 hash 文件，旧页面遇到图片 404 时提示刷新，不能静默展示其他条目图片。第三方平台缓存可能延迟更新，不承诺立即刷新。

### 6.4 分享 URL

统一通过 absoluteUrl(itemPath(item.id), lang, SITE_URL) 生成；不使用 window.location.origin，防止分享 localhost 或预览域名。默认不带筛选、时间轴、主题和临时参数。

中文：https://things-atlas.com/item/toilet-paper/  
英文：https://things-atlas.com/en/item/toilet-paper/

二维码编码与「复制链接」完全相同。V1 不增加 UTM；后续引入渠道参数时需保持 canonical 无跟踪参数。

## 7. 浏览器分享实现

海报预加载完成后取得 Blob，创建 File 并保存在当前弹窗状态。用户点击图片分享时，先 navigator.canShare({ files }) 判断，再立即调用 navigator.share；不要在点击后等待下载/制图，避免丢失 transient activation。

链接分享可独立调用 navigator.share({title, text, url})；文件分享单独检测能力，不能因为支持 URL 分享就假设支持文件。

保存使用同源 Blob object URL 和 download 文件名，例如 things-atlas-toilet-paper-zh.png。预览复用同一 Blob，确保保存的是看到的图片；切换/关闭时释放 object URL，下载触发后避免立即 revoke。浏览器不支持下载时提供打开原图及长按保存说明。

分享能力仅在 HTTPS/受支持环境下使用；权限拒绝时正常降级。系统分享完成不等于接收方实际发布或阅读，不把 resolved Promise 作为传播成功指标。

## 8. 性能与可观测性

- 不在首页预加载全量海报；首次点击分享才加载弹窗代码和当前图片，可按需预取另一语言。
- OG JPEG 目标不超过 300 KB，海报 PNG 目标不超过 1.5 MB；超过时检查压缩和图像复杂度，二维码清晰度优先。单张超过 3 MB 阻止发布。
- 分享图片新增的前端首屏请求数为 0；缺图或弱网不影响条目正文。
- 构建日志记录图片数量、总大小、失败条目与耗时；首轮全量实测后再确定 CI 时间预算，不预先承诺耗时。
- 若项目已有分析设施，复用记录 share_open、share_copy_link、share_download、share_system_result；仅传 item_id、lang、action、result，不记录完整 URL 或剪贴板内容。
- 无现成分析设施时不为此单独引入 SDK；可先通过人工发布实验观察访问。

## 9. 验收标准

### 自动检查

1. 每个条目两种语言都存在完整 poster / og manifest 记录，图片路径真实存在且尺寸、MIME 正确。
2. 每个预渲染条目 HTML 的 og:image / twitter:image 对应正确语言和条目；首页仍使用首页 OG 图。
3. 直接访问英文 URL、中文 URL 均返回正确语言元数据；运行时切换条目/语言也同步图片及 alt。
4. 规范链接不含 localhost、内部 /en 路径或无关查询参数。
5. 对公元前、世纪精度、争议、缺图、超长英文、缺字段建立代表性内容测试。
6. 两种海报二维码用独立解码器读取，结果必须等于对应分享 URL。
7. 原始尺寸下检查所有文本区域溢出；字体与图片加载失败必须让生成任务失败。
8. 全量文件数按当前数据动态计算，不硬编码 143。

### 浏览器与视觉验收

- Chrome 与 Safari 桌面检查弹窗、复制、下载；窄屏检查滚动和操作可达性。
- 支持文件分享的实际设备验证系统图片分享；不支持环境验证明确降级。
- 连续切语言、切条目、开关弹窗，不出现旧图、错误二维码或重复系统分享。
- 断网/图片 404/剪贴板拒绝/用户取消均有正确表现。
- 焦点返回、Tab 限制在弹窗内、Esc 与全局快捷键隔离符合预期。
- 检查所有生成图片的联系表，并放大复查最长名称、最长署名、无图、争议、古代年份及英文长段落。
- 实际手机扫描原图及聊天压缩后的样本；至少验证中英文各一张能打开对应条目。
- 社交平台真实链接预览只作集成验证；平台不读取 OG 时仍可使用手动图片分享。

实施后的验证包括数据/字体验证、分享专项测试和适用构建检查；遵守项目约定，不直接运行会触发全项目类型检查的现有 npm run build。发布前另按 AGENTS.md 执行 test:updates 和发布检查。

## 10. 实施分步

1. 样板：挑选普通图片、无图、古代记录、争议、长英文五类条目，完成中英两种版式和内容边界校验。
2. 生成：补齐字段 Schema、字体覆盖、二维码、hash manifest、全量生成和缓存策略。
3. 接入：分享弹窗、浏览器降级、预渲染及运行时 OG 同步。
4. 验收：全量资源校验、样本实机操作、部署预览验证。

本 spec 不包含业务代码改动或发布授权；实施时保持现有 URL 和条目阅读流程。发布版本号、日志和 push 仍按项目发布约定处理。

## 11. 参考

- Web Share API：https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
- share 与用户激活：https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- 文件能力判断：https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare
- Playwright 截图：https://playwright.dev/docs/screenshots
