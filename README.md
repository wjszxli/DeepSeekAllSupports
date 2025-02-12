# DeepSeekAllSupports - DeepSeek 网页助手

<div align="center">

<img src="public/icons/icon128.png" alt="DeepSeekAllSupports" width="128" />

</div>

## 📖 简介
DeepSeekAllSupports 是一款免费开源的浏览器扩展，支持 [DeepSeek](https://deepseek.com) 及其多平台服务，包括 DeepSeek 官方、硅基流动、腾讯云、百度云、阿里云 等。无论您使用哪家服务商，DeepSeekAllSupports 都能帮助您 无缝集成，轻松调用 DeepSeek 强大的 AI 能力，为您的工作和研究提供高效支持。


> **注意** 使用本插件需要您自己的 DeepSeek API Key。我们支持以下 API 服务商：
> - [DeepSeek](https://deepseek.com) 官方 API
> - [硅基流动](https://cloud.siliconflow.cn/i/lStn36vH) DeepSeek API
> - [腾讯云](https://cloud.tencent.com/document/product/1772/115969) DeepSeek API
> - [百度云](https://console.bce.baidu.com/iam/#/iam/apikey/list) DeepSeek API
> - [阿里云](https://bailian.console.aliyun.com/?apiKey=1#/api-key) DeepSeek API

## ✨ 核心特性

### 🎯 智能交互
- **智能文本分析**: 支持网页任意文本选择，即时获取 AI 分析和回复
- **多轮对话**: 支持基础的对话功能，实现连续对话交互
- **流式响应**: AI 回复实时流式显示，提供即时反馈 
- **模型选择**: 支持选择 DeepSeek V3 和 DeepSeek R1 模型
- **API 提供商**: 支持 DeepSeek 官方 API、硅基流动 DeepSeek API、腾讯云 DeepSeek API 、百度云 DeepSeek API、阿里云 DeepSeek API

### 🎨 内容展示
- **Markdown 渲染**: 支持丰富的 Markdown 格式，包括代码块、列表和数学公式（MathJax）
- **代码高亮**: 支持多种编程语言的语法高亮，并提供一键复制功能

# 如何安装
## 1. CRX 安装
### 方法一：直接拖动安装
1. **打开谷歌浏览器**：
   - 点击右上角的三个点，选择“更多工具”->“扩展程序”，或者直接在地址栏输入`chrome://extensions/`并回车。
2. **启用开发者模式**：
   - 在扩展程序页面，勾选右上角的“开发者模式”。
3. **拖动CRX文件**：
   - 下载 [CRX](./source/DeepSeekAllSupports.v1.0.0.crx) 文件，将其拖动到扩展程序页面中。
   - 松开鼠标后，会弹出一个窗口提示“添加扩展程序”，点击“添加”即可完成安装。
### 方法二：通过开发者模式安装
1. **打开谷歌浏览器**：
   - 同样进入扩展程序页面（`chrome://extensions/`）。
2. **启用开发者模式**：
   - 勾选右上角的“开发者模式”。
3. **加载已解压的扩展程序**：
   - 如果 [CRX](./source/DeepSeekAllSupports.v1.0.0.crx) 文件无法直接拖动安装，可以将其后缀名改为`.zip`，然后解压。
   - 点击“加载已解压的扩展程序”，选择解压后的文件夹。
4. **完成安装**：
   - 系统会自动加载并安装扩展程序，安装成功后会在扩展程序列表中显示。
### 注意事项
- **浏览器版本**：如果安装失败，可能是由于浏览器版本过高，可以尝试使用较低版本的Chrome浏览器（如Chrome 45以下版本）。
- **安全提示**：安装非官方的CRX文件可能存在安全风险，请确保下载的文件来源可靠。
参考链接：
- [爱问生活常识](https://iask.sina.com.cn/jxwd/1klAXL0lC2Xv.html)
- [极光下载站](http://www.xz7.com/article/104342.html)
- [太平洋电脑网](https://pcedu.pconline.com.cn/1627/16272284.html)
- [博客园](https://www.cnblogs.com/pengchong/p/12394078.html)
通过以上步骤，您应该能够在谷歌浏览器上成功安装CRX文件。如果有任何问题，请随时提问。

## 1. zip 包安装
### 写在安装之前
1. 其实这不是安装，而是加载使用。
2. 解压的文件夹不可以删除，因为之后浏览器都会读取；
4. 使用该方式时，浏览器每次启动时会提示“请停用以开发者模式运行的扩展程序”，需要关闭提示方可正常使用；
5. 如果可以你自由上网并且没有特别的新功能需求，可考虑使用市场版的方式安装（还在审核中）；

#### zip 包安装流程
1.下载压缩包
- 打开 https://github.com/wjszxli/DeepSeekAllSupports/releases
- 下载对应的版本的压缩包文件，如 DeepSeekAllSupports.v.1.0.zip，一般为Assert栏中第一个文件，请注意不要下载成 Source Code;
- 将压缩包内所有文件至指定目录，如 D:\DeepSeekAllSupports；
- 请确认该目录下是以下内容：
![WX20250211-111546](https://files.mdnice.com/user/14956/906ec0b4-93e9-4f91-a5c5-3c3851f30ac0.png)


2. 在浏览器中加载扩展
- 在 Chrome 地址栏中输入：chrome://extensions/ 回车，进入扩展程序；
- 勾选 开发者模式；
- 点击 加载已解压的扩展程序...；
- 选择之前解压的目录（如 D:\PT-Plugin-Plus ）；
- 开始使用；

## 2. 本地代码手动安装
### 可以代码编译项目
```bash
# 克隆项目
git clone https://github.com/wjszxli/DeepSeekAllSupports.git

# 安装依赖
pnpm install

# 构建项目
pnpm run build
```
### 浏览器安装
2. 在浏览器中加载扩展
- 在 Chrome 地址栏中输入：chrome://extensions/ 回车，进入扩展程序；
- 勾选 开发者模式；
- 点击 加载已解压的扩展程序...；
- 选择之前解压的目录（如 D:\PT-Plugin-Plus ）；
- 开始使用；

## 📮 联系我

- 项目问题: [GitHub Issues](https://github.com/wjszxli/DeepSeekAllSupports/issues)
- 邮件联系: wjszxli@gmail.com
---
<div align="center">
如果这个项目对您有帮助，请考虑给它一个 ⭐️
</div> 