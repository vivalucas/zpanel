# 前端验收与回归入口

本页按任务定位测试，不复制spec断言。实现契约见 [前端开发](frontend.zh-CN.md)，参数见 [UI](ui-design.zh-CN.md)，跨层/隔离见 [10](../handbook/10-quality.md)，当前结果、平台和集成缺口见 [01](../handbook/01-current-status.md)。有测试入口不等于对应实机已验收。

## 加载、缓存与派生展示

以下浏览器文件均位于 `tests/e2e/`。

| 修改主题 | 测试入口 |
| --- | --- |
| 公共壳/真实时钟、私有读取隔离、初始代码失败/刷新、路由竞态 | `home-startup.spec.ts` |
| 并行/分区/按需加载、取消/迟到结果、资源预算、图库原图/派生 | `loading-performance.spec.ts` |
| 菜单/编辑/排序/监控真实脚本失败、局部恢复/焦点/刷新 | `home-optional-modules.spec.ts` |
| 新鉴权后的快照、账号/角色/公开隔离、同值重验、设置入口、15秒期限 | `home-cache.spec.ts`；`src/lib/homeCache.test.ts`、`api.test.ts` |
| 派生URL/原地址、换图重置、两级回退 | `home-image-loading.spec.ts`；`src/lib/displayImage.test.ts` |
| 最新语言选择/英文回退、构建压缩 | `src/app/antdLocale.test.ts`、`src/locales/index.test.ts`、`src/lib/staticCompression.test.ts` |

取消须证明模块确实到达且迟到未重开；脚本失败须真实404/网络拒绝，慢后放行不能替代。刷新须真正重载取模块。资源预算必须含实际脚本/正字节；服务端WebP禁解码、旧缓存/伪装格式及HTTP/PWA另由10的Go测试验证，浏览器显示成功不足以证明内存安全。

虚拟时钟须先观察目标HTTP已发出，再推进计时，不能用共享加载文案代替。弱网记录代码基线、带宽/延迟、缓存/API模拟/样本条件，组合收益不归因单一机制；60个文字图标不能代表真实图片/外网/手机。

## 首页视觉与操作

| 修改主题 | 浏览器入口 |
| --- | --- |
| 首屏/边距/断点、固定工具/回顶/长页脚、键盘/命中 | `home-layout.spec.ts` |
| 人工色兼容、描边字重、首页/预览、上下文色 | `home-text-style.spec.ts` |
| 壁纸采样/裁切/模糊/遮罩与回退、首次提示/访客 | `home-appearance.spec.ts`、`wallpaper-rendering.spec.ts`；`src/lib/wallpaper.test.ts` |
| 地址分区/原生链接/复制/焦点/权限、窄矮/触屏菜单 | `item-menu.spec.ts` |
| 名称真实溢出、图标端点/材质/旧底色/失败恢复 | `item-title.spec.ts`、`item-icons.spec.ts` |

至少实查桌面/手机宽、浅深、默认/壁纸及两种导航样式。`toBeVisible()`和无溢出不能证明可达：结合完整视口、交叠、坐标、命中及生产computed style；浮层须等动画结束/边界稳定，真实长列表滚动不能force点击。链接快捷键用 `ControlOrMeta`，中键/修饰键/普通iframe分别查。

对比度取样等空组按钮前景达到标题目标，避免把Ant Design过渡算最终值。黑白自动模式至少 **4.5:1**，自定义不可达时不恶化原最差值、不可解析保留原图；普通描边不承诺任意壁纸透明文字4.5:1。持续错误必须失败，首页/预览比较同裁切/模糊/遮罩像素，截图须人工查看。

## 设置、草稿与故障恢复

| 修改主题 | 浏览器入口 |
| --- | --- |
| 自动保存/迟到回包/失败重试/离页、滑块真拖动 | `settings-auto-save.spec.ts`、`auto-save-navigation.spec.ts`、`wallpaper-preview-performance.spec.ts` |
| HTTP无randomUUID/验证码、默认引擎、脚本/安全模式、图库跨页、Docker故障/权限、保存loading退出 | `audit.spec.ts` |
| 首页缓存/菜单/监控/编辑、上传草稿A→B→A/重试互斥 | `ui-home-polish.spec.ts` |
| 设置身份/头像/配色/空图库、暂时刷新失败/鉴权拒绝、分区反馈 | `ui-settings-polish.spec.ts` |
| 外观控件名称/预览/上传，登录/排序/浮层无障碍 | `ui-appearance-polish.spec.ts`、`ui-accessibility.spec.ts` |
| 中英浅深/320px/侧栏断点、长名/坏图/焦点 | `settings-layout.spec.ts` |
| 编辑三类图标/双单列/短窗/错误上传/长选择器/真实保存 | `item-editor-layout.spec.ts` |
| 页面/会话/确认框、未保存保护、多账号/导航/导入导出 | `events.spec.ts`、`event-boundaries.spec.ts`、`workspace.spec.ts` |

`workspace.spec.ts` 后续依赖文件前部建数据，须完整运行，不能grep跳过。错误恢复须覆盖首次/有缓存刷新/保存后重取；401/403/业务鉴权拒绝在重试挂起期间仍隐藏缓存/动作。Docker首次错重试须挂起，保留错误卡、不闪空表/重复提交，再失败仍可重试。自动保存回归覆盖同页双分区失败不被成功覆盖，以及正常/减少动态效果；单图新选/旧重试互斥、多图并发分别查。纯函数/资料兼容另见 `queryState.test.ts`、`searchEngine.test.ts`、Go `user_profile_test.go`。

## 执行约束与证据

真实API用于导航/导入导出/上传引用/模块保存/CPU内存；验证码失败、Docker动作/日志、多页图库含模拟，验证码成功识别未自动化，磁盘依赖宿主挂载点，iframe取决于对端。模拟不替代真实Docker/手机/辅助技术。命令/产物隔离见10，历史独立复现见[16](../handbook/16-frontend-event-review.md)、全项目评审见[15](../handbook/15-project-review.md)，历史结果不作为本次通过；当前执行与未覆盖项只在01维护。
