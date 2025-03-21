## 前言

自 DeepSeek 推出以来，其回答质量备受好评。然而，许多用户在连续提问时经常遇到“服务器繁忙，请稍后再试”的提示。随着各大云服务商陆续部署 DeepSeek 的完整模型，我们其实可以通过这些厂商的 API，享受更加流畅和高效的 DeepSeek 体验，不仅响应速度更快，还能大幅减少因服务器负载导致的访问受限问题。

不过，直接调用各大厂商的 API 需要一定的开发能力，涉及接口调用、API Key 管理等操作，使用门槛较高。因此，我们开源了一款 DeepSeek 全平台支持插件 —— 一款免费、开源的浏览器扩展。它支持 DeepSeek 及多个云服务提供商（包括 DeepSeek 官方、硅基流动、腾讯云、百度云、阿里云等），让用户无需编写代码，即可一键集成 DeepSeek AI，轻松体验强大 AI 能力。

**📌 GitHub 项目地址：[DeepSeekAllSupports](https://github.com/wjszxli/DeepSeekAllSupports)**

## 开源插件支持服务商
该插件兼容多个 DeepSeek API 提供商，包括：

> - [DeepSeek](https://deepseek.com) 官方 API
> - [硅基流动](https://cloud.siliconflow.cn/i/lStn36vH) DeepSeek API
> - [腾讯云](https://cloud.tencent.com/document/product/1772/115969) DeepSeek API
> - [百度云](https://console.bce.baidu.com/iam/#/iam/apikey/list) DeepSeek API
> - [阿里云](https://bailian.console.aliyun.com/?apiKey=1#/api-key) DeepSeek API

🔜 未来计划支持更多服务商：科大讯飞、OpenRoute、字节跳动火山引擎等。

## 开源插件核心特性

### 智能交互

- **智能文本分析**: 支持网页任意文本选择，即时获取 AI 分析和回复。
- **多轮对话**: 支持连续对话，提供更自然的交流体验
- **流式响应**: AI 回复实时加载，提升交互流畅度。
- **多模型支持**: 可选择 DeepSeek V3 和 DeepSeek R1，自由切换模型体验。
- **多 API 提供商集成**: 兼容多家云服务 API，随心切换，稳定可靠。
- **快捷键操作**: 通过快捷键快速唤起插件，提高使用效率。
- **自由调整窗口**: 支持对话窗口自由拖拽、调整大小、固定位置。
- **一键复制 & 重新生成**: 支持 AI 回答一键复制，并提供重新生成功能。
- **自定义快捷键**: 支持自定义快捷键功能
- **支持本地部署模型**: 支持连接本地 Ollama 模型，避免网络依赖，畅享丝滑 AI 体验。
- **本地模型联网**：支持本地 Ollama 模型联网能力，增强可用性。
- **独立页面模式**：支持在浏览器单独打开 AI 对话界面，提升使用便捷性。

### 内容展示

- **Markdown 渲染**: 支持代码块、列表、数学公式（MathJax）等格式，增强阅读体验。
- **代码高亮**: 支持多种编程语言语法高亮。


## 接下来还将支持
- **一键总结页面**: 支持一键总结页面，生成页面的总结、摘要、思维导图等
- **一键翻译**: 支持将选中的内容一键翻译
- **一键多模型**: 支持将多个模型共同回答同一个问题
- **代码审查**: 支持在 gitlab、github 等平台进行代码审查




## 安装指南

## Chrome 商店（审核中）

审核通过后，可直接在 Chrome 扩展商店搜索 “DeepSeekAllSupports” 进行安装。

## 手动安装（zip 包）

1. **下载插件压缩包**
    - 访问 [GitHub Releases](https://github.com/wjszxli/DeepSeekAllSupports/releases)。
    - 下载最新版本的 DeepSeekAllSupports.v1.0.zip，解压至本地文件夹（如 D:\DeepSeekAllSupports）。
    - 请确保解压后的文件夹结构正确（参考下图）。

    ![目录结构](https://files.mdnice.com/user/14956/906ec0b4-93e9-4f91-a5c5-3c3851f30ac0.png)

2. **在 Chrome 浏览器中加载插件**
    - 访问 chrome://extensions/，启用**开发者模式**。
    - 点击 “**加载已解压的扩展程序**”，选择解压后的插件文件夹。
    - 安装完成后，即可在浏览器中启用插件。

## 源码安装

如果你希望自行编译插件，可以按照以下步骤进行：
```bash
# 克隆项目
git clone https://github.com/wjszxli/DeepSeekAllSupports.git

# 安装依赖
pnpm install

# 构建项目
pnpm run build
```
然后按照 ZIP 包安装方式，在浏览器中手动加载 extension 目录中的扩展程序。


## 如何使用

### 确保插件已启用

1. Chrome 插件有个开关，如何关闭会无法使用插件
   - 在 Chrome 地址栏输入 chrome://extensions/，查找 DeepSeekAllSupports。
   - 确保插件处于 启用 状态，否则请手动开启， 参考下图。

   ![image](https://files.mdnice.com/user/14956/8254890c-6115-4444-a09b-7759693d3ce3.png)

### 选择 API 提供商 & 配置 API Key

1. **固定插件**：点击 Chrome 右上角 扩展程序按钮，找到 DeepSeekAllSupports 并固定到工具栏。


   ![image](https://files.mdnice.com/user/14956/38511b25-f47a-4d27-aac2-88b945f52a82.png)


2. **选择服务商**：点击插件图标，在弹出的界面选择 API 提供商。
3. **获取 API Key**：

   - 例如，服务商选择了“阿里云”，点击 “获取 API Key”，会跳转至 API Key 管理页面。

   ![image](https://files.mdnice.com/user/14956/54c3ee05-3a7c-42be-84c6-e7930468be4d.png)


   ![image](https://files.mdnice.com/user/14956/cc5bb0d6-9eba-4aad-b304-9afc25807fa6.png)

   - 在 API Key 页面点击 “创建 API Key”，填写必要信息后生成 API Key

   ![image](https://files.mdnice.com/user/14956/49bf383f-fcec-4a4a-ba38-d78b7c9a849b.png)
   
4. **填入 API Key**：复制 API Key 并粘贴到插件的 API Key 输入框 中，点击 “保存配置”。
![image](https://files.mdnice.com/user/14956/09fe006a-e53b-4baf-b0e7-887a588aee18.png)
5. 测试 API 连接：保存 API Key 后，插件会自动进行 API 连接测试，成功后即可使用。


   ![image](https://files.mdnice.com/user/14956/0808b080-157b-4631-a888-1b5627b8bc66.png)
   
   ![image](https://files.mdnice.com/user/14956/0c313ca4-5dbd-4141-874c-19614d18403d.png)
   

### 体验 AI 功能
- **网页选中文本**：选中任意网页文本，点击 DeepSeek 图标，即可调起 AI 对话窗口。

![image](https://files.mdnice.com/user/14956/4201fc0e-3541-43fa-87b6-5a88cd4ffb64.png)

![image](https://files.mdnice.com/user/14956/3d6ac9bc-5d60-405e-abe0-967374ff367b.png)

- **连续对话**：在对话窗口与 AI 进行多轮交流，获得流畅体验

- **实时 AI 回复**：支持流式加载 AI 响应，提高交互效率。

![output](https://files.mdnice.com/user/14956/cbdf62b7-d3b2-4245-b801-49ccf267a946.gif)

### 🔍 体验 R1 模型
选择 DeepSeek R1 模型，可观察 AI 的推理过程，直观感受其思维逻辑。

![image](https://files.mdnice.com/user/14956/9219618d-ac17-4b86-8d83-54e1185c44f3.png)
![2](https://files.mdnice.com/user/14956/ee7dbbba-8e32-482a-a84a-117e24d77366.gif)

## 总结

DeepSeekAllSupports 是一款高效、便捷的 AI 插件，支持多个 DeepSeek API 提供商，让用户无需复杂的技术操作即可快速接入 AI 服务。无论是网页内容分析、多轮对话，还是代码高亮、Markdown 渲染，该插件都能提供一流的体验。

**🚀 立即体验 DeepSeek 极速 AI，探索更多可能性！**

**📌 GitHub 项目地址：[DeepSeekAllSupports](https://github.com/wjszxli/DeepSeekAllSupports)**