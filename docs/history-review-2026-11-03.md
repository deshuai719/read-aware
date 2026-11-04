# 历史修改复核：2026-11-03

> 以下是修复前的历史审查，不代表0.5.0-17的当前状态。后续修复与验证记录见 [0.5.0-17 验证记录](<D:/AAA软件项目/开源项目/read-aware-阅读器/.trellis/tasks/11-03-reader-release-repair/validation.md>)。源代码已变更，下文行号仅定位审查时版本。

## 结论

**NOT READY：当前工作树不适合直接打包为“已验收最新版”。**

前面的418个前端测试通过是真实的，但它们没有覆盖新增搜索生命周期、锁边界、合并失败和漫游资料冲突；类型检查不证明这些功能已经可用。本轮只读核查产品代码并生成这份报告，没有修复、提交、推送、发布或读写真实用户数据库。

## 审查基准与证据

- 仓库：ReadAware fork，分支 `feat/data-dir-config`。
- HEAD：`c0eaebe811248d76d42cec04891a7b3c34bd5e09`；审查面为 `git diff HEAD` 和未跟踪产品源码/规范。不是拿原上游主分支强行作本轮diff。
- 已有data-dir提交相对origin/main只领先1条，和本轮未提交功能分别处理。
- GitNexus CLI 1.6.12以`--index-only --pdg`索引当前工作树，未注入AGENTS/skills；索引校验覆盖1404文件。已调用detect-changes、精确UID context/impact、持久化guard的PDG impact。React回调值传递和跨语言边界使图为下界，最终结论仍由实际源码/探针确认。
- GitNexus FTS扩展加载失败，因此不宣称具备完整图搜索/taint审查；CLI无explain子命令，没有把缺失工具结果当安全证明。
- 复现使用实际源码和合成数据，不导出私密小说或读凭据。两位范围互斥的只读审查员已按用户的并发限制收尾，之后由lead串行核查。

## 本轮引入的缺陷

### 1. P1 — 多词搜索用精确 CFI 求交，正常同段落命中被清空

- 位置：[search-terms.ts:42–47](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/lib/search-terms.ts#L42-L47>)
- 根因与影响：CFI 在此指向每个匹配文字的精确 Range，而不是整段的共享ID。引擎由实际 Range 生成 CFI，两个不同词通常不可能拥有同一个 CFI。
- 证据/复现：执行实际 vendored search()，文本 Alice met Bob in the same paragraph.：Alice 的 offsets=0..5、Bob=10..13。按这些范围形成合法CFI后，现有 intersectSearchHits 输出 []，尽管两个词在同一段。
- 修正与回归：先明确短语/多词模式；多词按同段落或有界邻近范围验证，不能拿字符Range的CFI作段落ID。补真实不同CFI同段落测试。

### 2. P1 — 500条截断会将 AND 查询降级为只搜第一个词

- 位置：[useReaderSearch.ts:251–268](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/hooks/useReaderSearch.ts#L251-L268>)
- 根因与影响：runPass 达到上限后 complete=false；外层 break 后仍对已收集的 passes 求交。如果仅完成第一词的部分扫描，就直接返回第一词的500条结果。
- 证据/复现：内存执行实际hook，fake engine第一词alpha返回501条，第二词nonexistent无命中。查询alpha nonexistent，实际searchCalls=[alpha]，resultsReturned=500，missingTerm=null。第二个词根本没扫描。
- 修正与回归：区分取消/失败/限额/完整，不把未验证完所有词的结果当AND命中；上限应限制展示而不是跳过剩余查询条件。

### 3. P1 — 搜索跳转隐藏外壳，但没有结束搜索，阅读进度可能持续不保存

- 位置：[useReaderSession.ts:318–324](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/hooks/useReaderSession.ts#L318-L324>)
- 根因与影响：handleSearchResultSelect 仍执行 setShellVisible(false)。新查找条只在 visible=true 时渲染，而结束挂起的effect只观察searchOpen从true变false。跳转仅改变visible，因此条消失、searchOpen保持true、进度挂起不解除。
- 证据/复现：逐段核对 session → App → workspace → shell 的真实调用/属性链；[ReaderShellOverlay.tsx:174–178](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/components/ReaderShellOverlay.tsx#L174-L178>) 与 [ReaderShellOverlay.tsx:643–649](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/components/ReaderShellOverlay.tsx#L643-L649>)。GitNexus context指出此回调经值传递，完整行为由源代码验证，不以图中少量caller判安全。
- 修正与回归：查找条与阅读器外壳可见性解耦；统一搜索生命周期，隐藏/关闭/换书都处理挂起。补“点击命中后继续阅读、重启仍恢复正确进度”的跨层回归。

### 4. P1 — 额外添加的根书架搜索绕过合集密码锁

- 位置：[LibraryWorkspace.tsx:172–193](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/library/components/LibraryWorkspace.tsx#L172-L193>)
- 根因与影响：根搜索scope为所有books，包括锁定合集成员；结果直接进入Shelf，打开链没有解锁校验。用户明确要书内搜索，这个额外入口不仅偏题，还引入隐私回归。
- 证据/复现：实际scope回调+searchBooks的合成探针返回锁定合集成员ID；核对 Shelf → App → surface handoff → openReader，无锁校验。没有读取真实私密小说。
- 修正与回归：优先移除误加的书架搜索；若保留则必须在查询及打开执行点统一过滤/校验锁，不只靠磁贴遮盖封面。

### 5. P1 — 锁定合集的新右键动作泄露或移出成员

- 位置：[LibraryWorkspace.tsx:639–677](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/library/components/LibraryWorkspace.tsx#L639-L677>)
- 根因与影响：锁定磁贴仍能编辑简介/封面、导出书单、合并。编辑传入成员书名和封面；导出直接写标题、作者、进度；合并可将书移入无锁合集再删掉锁。
- 证据/复现：核对新增动作入口和handleExportCollection、handleMergeCollection及ProfileDialog参数；锁定画面被Montage隐藏，但新增动作没有相同的解锁门。
- 修正与回归：动作入口和执行时均检验锁状态，需要时要求解锁；补所有新增上下文动作的未解锁测试。

### 6. P2 — 合集合并不等迁移成功就删源、显示成功

- 位置：[LibraryWorkspace.tsx:375–385](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/library/components/LibraryWorkspace.tsx#L375-L385>)
- 根因与影响：onSetBooksCollection/onDeleteCollection都是void，内部异步catch不向调用者传播。迁移pending时源删除已请求；迁移失败但删除成功会丢失原合集名称、密码锁、归属，书籍文件本身并不被删除。
- 证据/复现：执行实际merge+controller回调，注入pending/reject赋值Promise。观察 assignment-start → source-delete-request → merged-success-toast，随后才reload/reportError。
- 修正与回归：返回并await可观察的Promise，迁移成功后才删源；最好同一domain事件事务原子合并。成功提示只在耐久写入完成后发出。

### 7. P2 — 搜索 Enter 会跳向旧查询结果，恢复进度也未完整闭环

- 位置：[ReaderSearchBar.tsx:136–149](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/components/ReaderSearchBar.tsx#L136-L149>)
- 根因与影响：输入改变后旧results在400ms内保留，Enter清掉timer后见到旧results就step，不检查这些结果属于当前query。关闭恢复只flush搜索前待写的位置，不主动提交当前命中；重开时origin仍存在，jump逻辑不再次挂起。
- 证据/复现：Enter代码分支和 setQuery/runSearch 分离已核对；实际throttle内存探针在origin=12%、preview=70%时resume flush仅提交12%。恢复仍先resume再异步seek；只捕获fraction没有精确CFI。
- 修正与回归：维护query/result generation，查询改变立即失效旧可导航结果；统一preview/accept/return/close状态，并在导航确认后恢复持久化。正文iframe内的点击需要显式桥接，父document的mousedown不覆盖iframe正文。

### 8. P2 — 同步后的旧合集 profile 会被本地排序覆盖

- 位置：[collection-profiles.ts:74–80](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/library/lib/collection-profiles.ts#L74-L80>)
- 根因与影响：Workspace仅useState初始化读取profile，没有订阅漫游更新。本地排序把旧profiles整键写回，能覆盖同步刚收到的简介和封面。
- 证据/复现：实际order/move合成探针：远端a.description已在KV，本地旧快照移动b后写成{b:{order:0},a:{order:1}}，remoteDescriptionPreserved=false。
- 修正与回归：订阅漫游偏好变化；写入前合并最新数据，避免整键旧快照覆写。update(id,{})并不删除旧profile，需专门remove接口；避免KV监听与显式publish双重事件。

### 9. P2 — 拖入合集分配失败只写日志，UI仍说成功

- 位置：[useLibraryController.ts:279–292](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/library/hooks/useLibraryController.ts#L279-L292>)
- 根因与影响：导入文件成功后assignBooks不await，失败仅log.warn，但outcome和books已被改成目标合集。
- 证据/复现：执行实际importSources，导入成功/赋值reject，返回imported+target，本地state仍target，用户错误报告为空。重载后书回根书架。
- 修正与回归：明确区分“导入成功、归档失败”，await分配并报告失败，重读或回滚；复用已有赋值错误处理。

### 10. P2 — 默认网格未接自选合集封面

- 位置：[CollectionTile.tsx:177](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/shelf/components/CollectionTile.tsx#L177>)
- 根因与影响：列表Montage传了data.coverUrl，默认网格只传coverUrls和locked。
- 证据/复现：实际组件React静态渲染，grid chosenCoverRendered=false、montage=true；list正确。此为组件属性证据，不冒充Tauri端到端。
- 修正与回归：网格同步传coverUrl，补两种布局的同一资料渲染用例。

### 11. P2 — 新增目录启发式会误删真实短章

- 位置：[text-chapters.ts:179–190](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/reader/lib/text-chapters.ts#L179-L190>)
- 根因与影响：连续短章后全文正文远多于紧接正文，就被判目录；现在不再要求标题在后文重复，也不限定在文件开头。
- 证据/复现：合成15个真实唯一标题章节：前两章很短、第三章中长、后12章较长。执行实际splitTextIntoChapters，结果只剩第4至15章，前3章并入无标题前言。
- 修正与回归：目录识别依赖重复/布局等证据，不凭后文长度推断；保留短章，补混合章型、短序场+长正文、真正无重复目录对照集。

### 12. P2 — AGENTS 仍是symlink mode，却被写入正文

- 位置：[AGENTS.md:1–32](<D:/AAA软件项目/开源项目/read-aware-阅读器/AGENTS.md#L1-L32>)
- 根因与影响：git index mode=120000，原内容是CLAUDE.md目标。Windows工作树现在为1748字节正文；提交时仍是symlink模式，目标会变成正文，不是可读取的指令文档。
- 证据/复现：git ls-files -s AGENTS.md → 120000；read工作树看到Trellis块。未断言Linux checkout一定失败（创建symlink不校验目标）；确认的是跨平台悬空链接/入口失效。
- 修正与回归：恢复CLAUDE.md链接并把Trellis块放到真实文档，或明确转换为100644常规文档。检查干净跨平台checkout。

### 13. P2 — Trellis规范尚未全部填实，部分把目标架构写成事实

- 位置：[desktop backend index:30–39](<D:/AAA软件项目/开源项目/read-aware-阅读器/.trellis/spec/desktop/backend/index.md#L30-L39>)
- 根因与影响：34个spec文件中13个仍有占位（56处）。唯一projection writer规则漏掉备份导入的library_put_*路径；agent每个side effect都经tool也不符合thread直接写conversation/memory。固定写死本机link.exe缺失，不应长期作为工程规范事实。
- 证据/复现：只读glob/grep与源代码对照，例 [quality-guidelines.md:19–51](<D:/AAA软件项目/开源项目/read-aware-阅读器/.trellis/spec/web/frontend/quality-guidelines.md#L19-L51>)。缺失模块警告中列出的几个文件当前确实不存在，这部分不应误报。
- 修正与回归：将已运行、已决策、已知例外分开；完成适用规范、删除不适用模板。工具链能力用运行检查，不把单机探测结论写死。

### 14. P2 — 发布说明按标签创建时间找上一版，重打标签可生成错误范围

- 位置：[release-notes.ts:53–63](<D:/AAA软件项目/开源项目/read-aware-阅读器/scripts/release-notes.ts#L53-L63>)
- 根因与影响：按creatordate相邻v标签决定previousTag，未限定同发布线/祖先。历史老版本重新标注或并行版本发布后，上一版可能选错。
- 证据/复现：当前原tag顺序正常；以真实git log和模拟旧v0.4.2重新标注顺序执行原脚本：v0.5.0-15..v0.5.0-16正常4条用户bullet，误选v0.4.2后变147条并生成错误compare链接。
- 修正与回归：CI明确传--prev，或按当前tag的同发布线祖先选择；补重标历史tag/并行发布线用例。

### 15. P2 — 将 Trellis 自身源码同步规则误植到 ReadAware

- 位置：[代码复用指南:217–220](<D:/AAA软件项目/开源项目/read-aware-阅读器/.trellis/spec/guides/code-reuse-thinking-guide.md#L217-L220>) 与 [Codex implement 配置:30](<D:/AAA软件项目/开源项目/read-aware-阅读器/.codex/agents/trellis-implement.toml#L30>)。
- 根因与影响：要求修改本地脚本后同步到 `packages/cli/src/templates/trellis/scripts`，甚至给出 `rsync --delete`。这是 Trellis 实现仓库的开发规则，本项目没有这棵目录。
- 证据/复现：读取两处指令并glob `packages/cli/**`、`src/templates/**`，没有匹配文件；Trellis包发现CLI只证明能读本项目规范，不证明这些跨仓库写回规则正确。
- 修正与回归：删除不适用的实现仓库专属要求，保留“项目脚本是本地配置、升级需审查”的正确边界；清查其他宿主配置中的同类误植，不创建无关模板树。

## 历史问题与需求未闭环（不算本轮引入）

- Beta更新发现仍查询[release-feed.ts:12](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/src/features/update/lib/release-feed.ts#L12>)中的ahpxex上游，而Rust更新下载allowlist只接受deshuai719 fork。匹配到上游manifest会被拒绝；这是HEAD已有问题，应在最新版发布验收时一起处理。稳定更新端点已指向fork，不要通过取消验证来修Beta。
- 合集封面目前只能从成员书封面里选，不是任意自定义图片上传；没有封面的TXT合集不能通过现UI直接设置新图片。
- 导出目前只有Markdown书单，不是能导回的合集manifest；清单导入尚未实现。全选移动是原有能力，不该把它当本轮新增。
- 用户明确不要自动/智能/嵌套/多归属合集，修正不应扩展这些方向。书内查找应维持轻量形态，不回退成大面板。
- 500条限制只限制hook收集，engine先对单节Array.from全部命中并创建高亮，所以不构成扫描/内存硬上限。见[view.js:554–587](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/web/public/foliate-js/view.js#L554-L587>)；应补大章节压力验收，而非只改UI数字。
- 旧回复“某样本26→25章节”应撤回：检查点记录是前后26个section/25个有标题章不变。本轮没有重新访问私密样本文件。
- 新发布说明生成仅影响未来release，历史release正文没有回填，不能说已全部显示更新内容。

## 最新版本与验证状态

- [tauri.conf.json:4](<D:/AAA软件项目/开源项目/read-aware-阅读器/apps/desktop/src-tauri/tauri.conf.json#L4>)仍为`0.5.0-16`，已有同名tag；Android versionCode仍5000012。根包/网页package version不是桌面安装包版本。
- 常规项目bundle/debug/release、Android outputs、build/dist/release-assets未找到现有安装包；未生成含本轮改动的安装器。
- 本轮重新实跑web `bun run typecheck` 与 `bun test`，真实exit均0，结果418 pass/0 fail、951 expectations、66 files。reader hooks目录没有hook集成测试。
- 之前全仓17/17 typecheck是历史结果，本轮未重跑会重新生成插件dist的全仓命令，不混记为新的验证。
- Rust改动没有本轮编译验证，Tauri产品行为没有本轮真机验收。仅Get-Command查不到link/cl不等价于已证明Build Tools未安装；不要继续沿用那个过度断言。

## 建议执行顺序

1. 先修锁边界和合并异步语义，防止隐私外泄/合集归属损坏。
2. 重整书内查找状态机：query generation、preview/accept/return/close、精确CFI原点、导航完成后恢复持久化；接上iframe正文交互。
3. 修AND语义与截断策略，补真实范围的同段落/短语/大小写/长章节测试。
4. 修合集资料同步、导入分配错误、网格封面、短章识别及AGENTS文件模式；把规范写实。
5. Tauri验收后统一版本号、生成安装包、签名和更新manifest，最后发布；不只改版本号就称作新版。

## 覆盖限制

此报告不是对整个948条上游提交的完整审查，也未宣称所有未改文件安全。部分source-backed生命周期问题需要真实Tauri导航/退出/重启验证；没有把浏览器截图或纯函数测试充当持久化端到端证明。
