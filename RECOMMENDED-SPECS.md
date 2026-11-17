# Recommended specs

Equity Desk runs on most Windows PCs. The charts, news and data tabs are light. The built-in **AI assistant** is the heavy part, because by default it runs a language model on your own computer through [Ollama](https://ollama.com). How fast it answers depends almost entirely on your hardware.

> **Note:** The AI speeds below are **estimates** based on published benchmarks for the same models. They have not yet been measured on every kind of laptop. If you test Equity Desk on your machine, please share your results in an issue.

## Quick summary

| Tier | Hardware | AI assistant experience |
| --- | --- | --- |
| **Minimum** | Windows 10/11 64-bit, 4-core CPU, 8 GB RAM, 2 GB free disk | App runs fine. Local AI is not practical: use a cloud AI provider in **SET**, or turn the assistant off |
| **Usable** | 16 GB RAM, recent Intel Core i5 / AMD Ryzen 5, 15 GB free disk | Local AI works but is slow: about **2 to 4 minutes** per answer |
| **Recommended** | 32 GB RAM, Intel Core i7 / Ryzen 7 with DDR5 memory, 25 GB free disk | Local AI is workable: about **1 to 2 minutes** per answer |
| **Best** | A laptop or desktop with an NVIDIA GPU (6 GB VRAM or more), 16 GB+ RAM | Local AI feels quick: about **10 seconds** per answer |

Disk space includes the app (about 300 MB) plus local AI models (Gemma 4 E4B is about 10 GB; gpt-oss 20B is about 14 GB).

## Expected AI assistant speed

Times are for one question with **Desk context** turned on and an answer of about 300 tokens (roughly 200 words).

| Computer | Model | Wait before the first word | Writing speed | Whole answer |
| --- | --- | --- | --- | --- |
| Intel Core i5, 16 GB, built-in graphics | Gemma 4 E4B (default) | 60 to 140 s | 3 to 7 tokens/s | 2 to 4 min |
| Intel Core i5, 16 GB, built-in graphics | gpt-oss 20B | Not recommended: the model needs about 14 GB and the PC runs out of memory | under 3 tokens/s | many minutes |
| Intel Core i7, 32 GB, built-in graphics | Gemma 4 E4B | 30 to 70 s | 8 to 14 tokens/s | 1 to 2 min |
| Intel Core i7, 32 GB, built-in graphics | gpt-oss 20B | 40 to 90 s, plus up to a minute of thinking | 10 to 18 tokens/s | 1.5 to 3 min |
| Any PC with NVIDIA RTX 4050/4060 or better | Gemma 4 E4B | 2 to 4 s | 40 to 60 tokens/s | about 10 s |
| MacBook Air (Apple M-series, 16 GB) with Ollama for macOS | Gemma 4 E4B | 4 to 9 s | 35 to 57 tokens/s | 10 to 20 s |
| MacBook Pro (Apple M Pro / Max) with Ollama for macOS | Gemma 4 E4B | 2 to 4 s | 55 to 65 tokens/s | 8 to 10 s |
| Mac running Equity Desk under Wine, with Windows Ollama | Gemma 4 E4B | 1.5 to 6 min | 2 to 6 tokens/s | 3 to 8 min |

The first question after the AI has been idle for a few minutes can take an extra 10 to 30 seconds while the model loads from disk.

## Choosing a local model

| Your computer | Suggested model |
| --- | --- |
| 16 GB RAM or less, no NVIDIA GPU | Gemma 4 E2B (smallest, fastest), or a cloud provider |
| 16 to 24 GB RAM | Gemma 4 E4B (default) |
| 32 GB RAM or more, or a GPU with 16 GB VRAM | gpt-oss 20B or Gemma 4 26B |
| 64 GB RAM / 24 GB GPU or more | Gemma 4 31B |

You can download, switch and remove models in **SET**.

## macOS (not officially supported)

Equity Desk is a Windows app. Some people run it on a Mac with Wine. If you do:

- **Install the macOS version of Ollama** from [ollama.com/download](https://ollama.com/download) and download `gemma4` there (`ollama pull gemma4`).
- Start Ollama before opening Equity Desk. The app connects to Ollama at `127.0.0.1:11434` and will use the Mac version, which uses the Apple GPU.
- Without it, the app starts the Windows version of Ollama inside Wine. That version cannot use the Apple GPU and is roughly 10 to 30 times slower.

## Tips for faster answers

- **Turn off Desk context** when your question does not need chart data. It adds a lot of text the model has to read.
- **Start a new chat** (Clear) after a few questions. Long chats get slower with every message.
- **Close other heavy apps** (browsers with many tabs, video calls) on 16 GB machines, so the model stays in memory.
- **Plug in your laptop** and use a high-performance power mode. Battery-saving modes can halve AI speed.
- **Use a cloud provider** (Claude, ChatGPT, Gemini and others in **SET**) on slower PCs. Answers take seconds, but they are paid and your question is sent to that provider.

## How these numbers were estimated

- Mac figures come from published llama.cpp, MLX and Ollama runs of Gemma 4 E4B on Apple M1 Max, M3 Max and M4 machines.
- Windows CPU-only figures are scaled from memory bandwidth (dual-channel DDR4 about 40 to 50 GB/s, DDR5 about 70 to 80 GB/s) and CPU-only reports for the same model.
- Wine figures are reasoned from how Wine runs Windows programs on Apple Silicon. No published benchmark was found.
- Prompt size was measured from Equity Desk's own requests: about 2,800 tokens for a first question with Desk context on.

Sources: [Six local AI models on an M1 Max](https://bishal.io/blog/six-local-models-m1-max-llama-cpp-vs-mlx/) · [Gemma 4 E4B Apple Silicon benchmark](https://siliconscore.com/models/gemma-4-e4b/) · [Every Gemma 4 model on a MacBook](https://www.kartit.net/blog/gemma4-local-benchmark) · [Gemma 4 CPU only](https://gemma4all.com/blog/gemma-4-cpu-only) · [Introducing gpt-oss](https://openai.com/index/introducing-gpt-oss/) · [Ollama with MLX on Apple Silicon](https://ollama.com/blog/mlx)

*Last updated: November 2026.*
