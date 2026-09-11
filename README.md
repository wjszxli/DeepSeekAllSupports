# AiAllSupport - Ai Web Assistant

<div align="center">
<img src="public/icons/icon128.png" alt="AiAllSupport" width="128" />
</div>

[English](README.md) | [简体中文](README.zh-CN.md)

## 📖 Introduction

**AiAllSupport** is a free and open-source browser extension that supports Ai and its multi-platform services, including DeepSeek official, SiliconFlow, Tencent Cloud, Baidu Cloud, Alibaba Cloud, and local AI models. No matter which provider you use, AiAllSupport helps you seamlessly integrate and easily access DeepSeek’s powerful AI capabilities, providing efficient support for your work and research.

## Supported API Providers

This extension is compatible with multiple DeepSeek API providers, including:

> - [DeepSeek](https://deepseek.com) Official API
> - [SiliconFlow](https://cloud.siliconflow.cn/i/lStn36vH) DeepSeek API
> - [Tencent Cloud](https://cloud.tencent.com/document/product/1772/115969) DeepSeek API
> - [Baidu Cloud](https://console.bce.baidu.com/iam/#/iam/apikey/list) DeepSeek API
> - [Alibaba Cloud](https://bailian.console.aliyun.com/?apiKey=1#/api-key) DeepSeek API
> - [Local](https://ollama.com/) DeepSeek API
> - [OrcaRouter](https://www.orcarouter.ai) — OpenAI-compatible AI gateway

### OrcaRouter

OrcaRouter is an OpenAI-compatible AI gateway built for both models and agents,
with adaptive routing, automatic failover, zero-markup inference,
observability, guardrails, and agent-tool governance. It also runs
gateway-level, zero-trust security for AI agents on the same endpoint —
screening every prompt and response and governing every tool call on a
default-deny basis, with no application code changes.

Two provider entries are available, each with its own way of getting a
credential:

| Entry | How you connect | Credential |
| --- | --- | --- |
| **OrcaRouter - API** | Paste an `sk-orca-…` key you created in the [OrcaRouter console](https://www.orcarouter.ai) | Your own API key |
| **OrcaRouter - Auth** | **Connect with OrcaRouter** — authorize in your browser with OAuth 2.0 + PKCE | An API key issued to this app, billed to your account |

Both entries reach the same inference API and the same model list, and both
store the key wherever this extension already stores provider secrets. Neither
requires a client secret, and neither needs a redirect URI registered in
advance. The PKCE-issued key is a normal OrcaRouter API key: it is billed to
your OrcaRouter account and you can revoke it at any time from
[Authorized apps](https://www.orcarouter.ai/console/authorized-apps). It is a
durable grant rather than a refreshable token, so it is reused until revoked.

Model lists are fetched live from `GET https://api.orcarouter.ai/v1/models`
using your key, then filtered by what the current input can actually send. If
the catalog is unreachable, a small verified fallback list is shown and clearly
labelled as degraded — the picker never degrades to free-text entry.

Authentication and inference use different origins: keys come from
`https://www.orcarouter.ai`, inference runs against
`https://api.orcarouter.ai/v1`.

🔜 Future plans to support more providers: iFlytek, OpenRoute, ByteDance VolcEngine, and more.

## Core Features

### Intelligent Interaction

- **Smart Text Analysis**: Select any text on a webpage to get instant AI analysis and responses.
- **Multi-turn Conversations**: Supports contextual conversations for a more natural interactive experience.
- **Streaming Responses**: AI responses load in real-time for a smoother interaction.
- **Multi-Model Support**: Switch freely between DeepSeek V3, DeepSeek R1, and more for a personalized AI experience.
- **Multi-Provider API Integration**: Compatible with various cloud service APIs, ensuring stability and reliability.
- **Adjustable Window**: Supports global drag-and-drop, resizable UI (bottom-right corner), and fixed positioning for different use cases.
- **Local Model Support**: Connect with local Ollama models for offline AI usage.
- **Keyboard Shortcuts**: Quick access to the extension for improved efficiency.
- **Customizable Shortcuts**: Personalize key bindings to match your workflow.
- **One-Click Copy & Regenerate**: Easily copy AI responses and regenerate content.
- **Interrupt AI Responses**: Stop AI replies at any time for better control over interactions.
- **Local Model Internet Access**: Allows locally deployed models to access online information for comprehensive answers while maintaining privacy.
- **Prompt Capabilities**: Built-in prompt templates for quick and efficient AI usage.
- **Standalone Window Mode**: Open AI interactions in a separate window for better usability.

### Content Display

- **Markdown Rendering**: Supports code blocks, lists, mathematical formulas (MathJax), and more for enhanced readability.
- **Syntax Highlighting**: Provides code highlighting for multiple programming languages.
- **Code & Formula Copy**: Enables easy copying of code snippets and mathematical formulas.

## Upcoming Features

### ✅ One-Click Page Summarization

Supports one-click page summarization, generating summaries, abstracts, and mind maps.

### ✅ One-Click Translation

Supports right-click one-click translation of articles and text.

### ✅ Multi-Model Responses

Supports getting responses from multiple models simultaneously for comparison.

### ✅ Code Review

Supports code review on platforms like GitLab and GitHub.

### ✅ Concurrent Querying

Allows a single question to be asked to multiple providers and models, compares results, and enables separate response windows that can be freely dragged and closed.

### ✅ More Features

Looking forward to your suggestions, feel free to contact me.

## How to Install

[Installation Guide](./public/doc/install.md)

## How to Use

[Usage Guide](./public/doc/use.md)

## Contribution Guide

## Contribution Guide

We welcome all forms of contributions, including new features, bug fixes, and documentation improvements.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## Contact Me

- **Project Issues**: [GitHub Issues](https://github.com/wjszxli/AiAllSupport/issues)
- **Email**: [wjszxli@gmail.com]

---

<div align="center">
If you find this project helpful, please consider giving it a ⭐️!
</div>
