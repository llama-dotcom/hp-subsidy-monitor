const DATA_CODING_TOOLS = [
  {
    "id": "cursor",
    "name": "Cursor",
    "developer": "Anysphere",
    "owner": "Anysphere (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-native",
    "launch_date": "2023-03-01",
    "description": "VS Code fork that became the dominant AI-native IDE in 2026, surpassing $2B ARR with over 1 million daily users by March 2026. Known for its proprietary Tab autocomplete, Composer agent mode, and deep multi-file context understanding.",
    "pricing": {
      "free_tier": true,
      "free_details": "Hobby plan with limited completions and 50 slow Premium requests/month",
      "pro_price": "$20/mo",
      "enterprise": true
    },
    "estimated_users": "1M+ daily, 50K+ businesses",
    "market_position": 1,
    "pros": [
      "Best-in-class autocomplete via Tab model",
      "Powerful Composer agent for multi-file edits",
      "Familiar VS Code interface and extensions",
      "Used by over half of the Fortune 500"
    ],
    "cons": [
      "Expensive at scale, frequent pricing changes",
      "Heavy resource usage on large codebases",
      "Privacy concerns - code routed through Anysphere backend",
      "Lock-in risk with proprietary Tab model"
    ],
    "use_cases": [
      "Day-to-day full-stack development",
      "Multi-file refactoring",
      "Rapid prototyping",
      "Learning new codebases"
    ],
    "supported_ides": ["Cursor (standalone, VS Code fork)"],
    "url": "https://cursor.com"
  },
  {
    "id": "claude-code",
    "name": "Claude Code",
    "developer": "Anthropic",
    "owner": "Anthropic",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2025-02-24",
    "description": "Anthropic's agentic terminal coding tool that exploded in popularity through 2025-2026, becoming the leading CLI coding agent. Tightly integrated with Claude Sonnet 4.6/Opus 4.6 and now offers a web version, IDE integrations, and persistent project memory.",
    "pricing": {
      "free_tier": false,
      "free_details": "No free tier; bundled with Claude Pro/Max subscriptions",
      "pro_price": "$20/mo (Pro), $100-$200/mo (Max)",
      "enterprise": true
    },
    "estimated_users": "Millions (fastest growing 2025-26)",
    "market_position": 2,
    "pros": [
      "Excellent reasoning and long-horizon task execution",
      "Works in any terminal, no IDE lock-in",
      "Strong tool use and MCP ecosystem",
      "Direct git/file/test execution with audit trail"
    ],
    "cons": [
      "Costly for heavy users; new restrictions on third-party tools (April 2026)",
      "Requires comfort with terminal workflows",
      "Tied exclusively to Anthropic models",
      "Usage limits hit quickly on Pro plan"
    ],
    "use_cases": [
      "Autonomous feature implementation",
      "Large refactoring projects",
      "Codebase exploration and documentation",
      "CI/CD and shell automation"
    ],
    "supported_ides": ["Terminal", "VS Code", "JetBrains", "Web"],
    "url": "https://claude.com/product/claude-code"
  },
  {
    "id": "github-copilot",
    "name": "GitHub Copilot",
    "developer": "GitHub",
    "owner": "Microsoft",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-extension",
    "launch_date": "2021-06-29",
    "description": "The original mainstream AI coding assistant, now offering five tiers including a free plan, agent mode (GA on JetBrains as of March 2026), an autonomous coding agent that opens PRs, and GitHub Spark for natural-language app building.",
    "pricing": {
      "free_tier": true,
      "free_details": "Limited completions and chat requests, basic models",
      "pro_price": "$10/mo (Pro), $39/mo (Pro+)",
      "enterprise": true
    },
    "estimated_users": "20M+",
    "market_position": 3,
    "pros": [
      "Tightest GitHub integration (PRs, issues, Actions)",
      "Multi-model choice (GPT-5, Claude, Gemini)",
      "Mature enterprise compliance and SSO",
      "Free tier is genuinely usable"
    ],
    "cons": [
      "Slower to ship cutting-edge features than Cursor/Claude Code",
      "Spark only on Pro+ and Enterprise tiers",
      "Agent mode still less capable than dedicated agents",
      "Microsoft-only LLM data routing concerns for some enterprises"
    ],
    "use_cases": [
      "Mainstream enterprise development",
      "GitHub-centric workflows",
      "PR review and issue resolution",
      "Polyglot coding inside VS Code/JetBrains"
    ],
    "supported_ides": ["VS Code", "Visual Studio", "JetBrains", "Neovim", "Xcode", "Eclipse"],
    "url": "https://github.com/features/copilot"
  },
  {
    "id": "windsurf",
    "name": "Windsurf",
    "developer": "Windsurf (formerly Codeium)",
    "owner": "Cognition AI",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-native",
    "launch_date": "2024-11-13",
    "description": "AI-native IDE acquired by Cognition AI in July 2025 after the OpenAI deal collapsed and Google licensed its tech for $2.4B. Now integrates Devin agent capabilities and ranked #1 in LogRocket's AI Dev Tool Power Rankings as of February 2026.",
    "pricing": {
      "free_tier": true,
      "free_details": "Limited Cascade credits and basic completions",
      "pro_price": "$15/mo",
      "enterprise": true
    },
    "estimated_users": "1M+",
    "market_position": 4,
    "pros": [
      "Cascade agent with deep multi-file awareness",
      "Now backed by Cognition's Devin technology",
      "Generous free tier compared to Cursor",
      "59% of Fortune 500 reported using it"
    ],
    "cons": [
      "Brand confusion after OpenAI-Google-Cognition saga",
      "Roadmap uncertainty during integration with Cognition",
      "Original Codeium founders left for Google",
      "Less mature than Cursor for very large codebases"
    ],
    "use_cases": [
      "Agent-driven feature development",
      "Enterprise dev teams",
      "Multi-file refactors",
      "Cascade-style autonomous workflows"
    ],
    "supported_ides": ["Windsurf (standalone, VS Code fork)", "JetBrains plugin", "VS Code plugin"],
    "url": "https://windsurf.com"
  },
  {
    "id": "gemini-code-assist",
    "name": "Gemini Code Assist",
    "developer": "Google",
    "owner": "Google (Alphabet)",
    "country": "USA",
    "country_code": "us",
    "cluster": "specialized",
    "launch_date": "2024-04-09",
    "description": "Google's AI coding assistant, dramatically strengthened in 2025-2026 by integrating Windsurf technology and ex-Codeium engineers acquired in the $2.4B deal. Free for individuals with generous limits and Gemini 2.5/3.0 Pro context windows.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free for individuals with high daily limits, no credit card",
      "pro_price": "$19/user/mo (Standard)",
      "enterprise": true
    },
    "estimated_users": "Millions via free tier",
    "market_position": 5,
    "pros": [
      "Massive free tier for individuals",
      "Huge context window (Gemini 2M+ tokens)",
      "Tight GCP and Firebase integration",
      "Boosted by ex-Windsurf talent and tech"
    ],
    "cons": [
      "Less polished agent mode than Cursor or Claude Code",
      "Best benefits require Google Cloud lock-in",
      "Quality inconsistent vs Anthropic/OpenAI for coding",
      "Enterprise pricing complex"
    ],
    "use_cases": [
      "Google Cloud development",
      "Cost-conscious individuals",
      "Long-context codebase analysis",
      "Firebase/Android projects"
    ],
    "supported_ides": ["VS Code", "JetBrains", "Android Studio", "Cloud Workstations"],
    "url": "https://codeassist.google"
  },
  {
    "id": "replit",
    "name": "Replit",
    "developer": "Replit Inc.",
    "owner": "Replit (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cloud-ide",
    "launch_date": "2016-01-01",
    "description": "Browser-based development platform whose Replit Agent (now v4) became one of the leading vibe-coding tools in 2025-2026. Effort-based pricing, full deployment stack, and the new flat-fee Pro plan (Feb 2026) replaced Teams.",
    "pricing": {
      "free_tier": true,
      "free_details": "Starter plan with daily Agent credits and limited compute",
      "pro_price": "$17/mo (Core), $95/mo (Pro)",
      "enterprise": true
    },
    "estimated_users": "30M+ accounts",
    "market_position": 6,
    "pros": [
      "Zero local setup, runs in browser",
      "Built-in hosting, database, and deployment",
      "Agent 4 is fast and increasingly reliable",
      "Strong for non-developers and education"
    ],
    "cons": [
      "Effort-based pricing can surprise users with bills",
      "Less powerful for very large production codebases",
      "Performance limited vs local IDEs",
      "Vendor lock-in for hosted apps"
    ],
    "use_cases": [
      "Vibe coding and prototyping",
      "Education and learning to code",
      "Quick MVP/SaaS launches",
      "Collaborative pair programming"
    ],
    "supported_ides": ["Replit (browser-based)"],
    "url": "https://replit.com"
  },
  {
    "id": "lovable",
    "name": "Lovable",
    "developer": "Lovable",
    "owner": "Lovable (independent)",
    "country": "Sweden",
    "country_code": "se",
    "cluster": "cloud-ide",
    "launch_date": "2024-11-21",
    "description": "Stockholm-based AI app builder that became one of the fastest-growing software companies in history, hitting $300M+ ARR in under 12 months and a $6.6B valuation in December 2025. Lovable 2.0 (Feb 2026) added 20-user real-time collaboration and Chat Mode reasoning agent.",
    "pricing": {
      "free_tier": true,
      "free_details": "5 daily credits, $25 cloud + $1 AI/month bonus through May 2026",
      "pro_price": "$20/mo (Starter), $50/mo (Launch), $100/mo (Scale)",
      "enterprise": true
    },
    "estimated_users": "5M+",
    "market_position": 7,
    "pros": [
      "Best-in-class for non-technical builders",
      "Beautiful default UI generation",
      "Real-time multi-user collaboration",
      "European GDPR-friendly hosting option"
    ],
    "cons": [
      "Credit depletion is the #1 user complaint",
      "Generated code can be fragile/buggy",
      "Limited fine-grained code control",
      "Less suitable for large existing codebases"
    ],
    "use_cases": [
      "Non-technical founders building MVPs",
      "Marketing landing pages",
      "Internal tools and dashboards",
      "Rapid prototyping for client demos"
    ],
    "supported_ides": ["Lovable (browser-based)"],
    "url": "https://lovable.dev"
  },
  {
    "id": "bolt-new",
    "name": "Bolt.new",
    "developer": "StackBlitz",
    "owner": "StackBlitz (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cloud-ide",
    "launch_date": "2024-10-03",
    "description": "Browser-based AI app builder powered by StackBlitz's WebContainers tech that runs Node.js fully in the browser. Hit $40M ARR within 5 months of launch; Bolt V2 added Bolt Cloud with built-in DB, auth, and edge functions.",
    "pricing": {
      "free_tier": true,
      "free_details": "Limited daily tokens and project hours",
      "pro_price": "$20/mo (Pro), $50/mo (Teams)",
      "enterprise": true
    },
    "estimated_users": "5M+ signups",
    "market_position": 8,
    "pros": [
      "WebContainers tech runs everything in browser",
      "Excellent for full-stack JS/TS apps",
      "67% of users are non-developers",
      "Built-in deployment via Bolt Cloud"
    ],
    "cons": [
      "Token consumption can be aggressive",
      "Best for JS/TS ecosystem only",
      "Less polished than Lovable for pure UI",
      "Generated apps require manual cleanup for production"
    ],
    "use_cases": [
      "Full-stack JavaScript/TypeScript apps",
      "Quick prototyping in browser",
      "Vibe coding for indie hackers",
      "Replit/Lovable alternative"
    ],
    "supported_ides": ["Bolt (browser-based)"],
    "url": "https://bolt.new"
  },
  {
    "id": "amazon-q-developer",
    "name": "Amazon Q Developer",
    "developer": "Amazon Web Services",
    "owner": "Amazon",
    "country": "USA",
    "country_code": "us",
    "cluster": "specialized",
    "launch_date": "2024-04-30",
    "description": "AWS's AI coding assistant (rebranded from CodeWhisperer) with strong code transformation agents for legacy migrations like Java 8 to 17 and .NET upgrades. Deep AWS service integration and built-in license/security scanning.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free tier with monthly limits via AWS Builder ID",
      "pro_price": "$19/user/mo (Pro)",
      "enterprise": true
    },
    "estimated_users": "Large via AWS bundle",
    "market_position": 9,
    "pros": [
      "Best-in-class for AWS-centric workloads",
      "Code transformation agents for legacy migrations",
      "Built-in security scanning and license tracking",
      "Enterprise IAM and compliance ready"
    ],
    "cons": [
      "Heavily biased toward AWS services",
      "Generic coding quality lags Cursor/Copilot",
      "Pricing for transformation agents complex",
      "Not strong outside AWS ecosystem"
    ],
    "use_cases": [
      "AWS application development",
      "Java/.NET legacy modernization",
      "Enterprise security-sensitive teams",
      "Cloud infrastructure as code"
    ],
    "supported_ides": ["VS Code", "JetBrains", "Visual Studio", "AWS Cloud9", "CLI"],
    "url": "https://aws.amazon.com/q/developer/"
  },
  {
    "id": "v0",
    "name": "v0 by Vercel",
    "developer": "Vercel",
    "owner": "Vercel (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cloud-ide",
    "launch_date": "2023-10-12",
    "description": "Vercel's AI app builder, evolved from a component generator into a full-stack platform after the February 2026 update added Git integration, VS Code-style editor, sandbox runtime, database connectors, and token-based billing.",
    "pricing": {
      "free_tier": true,
      "free_details": "$5/month in credits",
      "pro_price": "$20/mo (Premium), $30/user/mo (Team)",
      "enterprise": true
    },
    "estimated_users": "Millions via Vercel",
    "market_position": 10,
    "pros": [
      "Best React/Next.js + shadcn/ui generation",
      "Production-ready Vercel deployment in one click",
      "Now full-stack with DB and API support",
      "Strong design-to-code workflows"
    ],
    "cons": [
      "Token billing replaced predictable credits in Feb 2026",
      "Locked to React/Next.js ecosystem",
      "Vercel hosting lock-in",
      "Complex apps still need manual cleanup"
    ],
    "use_cases": [
      "React/Next.js component generation",
      "Marketing site building",
      "Full-stack Vercel apps",
      "Designer-to-code prototyping"
    ],
    "supported_ides": ["v0.app (browser-based)"],
    "url": "https://v0.app"
  },
  {
    "id": "trae",
    "name": "Trae",
    "developer": "ByteDance",
    "owner": "ByteDance",
    "country": "China",
    "country_code": "cn",
    "cluster": "ide-native",
    "launch_date": "2025-01-20",
    "description": "ByteDance's free AI-first IDE built on a VS Code fork, offering unlimited free access to Claude Sonnet, GPT-4o, DeepSeek R1, and Gemini 2.5 Pro. Builder Mode autonomously scaffolds entire projects from a single prompt; positioned as the 'free Cursor alternative'.",
    "pricing": {
      "free_tier": true,
      "free_details": "Full IDE with premium models, rate-limited at peak",
      "pro_price": "$10/mo",
      "enterprise": false
    },
    "estimated_users": "Rapid growth in Asia",
    "market_position": 11,
    "pros": [
      "Truly generous free tier with premium models",
      "Multimodal: accepts screenshots and design mockups",
      "Builder Mode generates full projects from prompts",
      "Familiar VS Code interface"
    ],
    "cons": [
      "Privacy concerns - data flows to ByteDance",
      "Geopolitical scrutiny in US/EU",
      "Limited transparency on data handling",
      "Less mature agent than Cursor/Windsurf"
    ],
    "use_cases": [
      "Cost-sensitive developers and students",
      "Rapid project scaffolding",
      "Developers in Asia-Pacific",
      "Trying premium models without subscriptions"
    ],
    "supported_ides": ["Trae (standalone, VS Code fork)"],
    "url": "https://www.trae.ai"
  },
  {
    "id": "codex-cli",
    "name": "Codex CLI",
    "developer": "OpenAI",
    "owner": "OpenAI",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2025-04-16",
    "description": "OpenAI's open-source terminal coding agent (Apache 2.0) that brings GPT-5 and codex-mini into local workflows. Includes Codex Web cloud sandbox where each task runs in an isolated environment preloaded with the user's repo.",
    "pricing": {
      "free_tier": false,
      "free_details": "Tool is free/open source; pay for API or ChatGPT subscription",
      "pro_price": "$20/mo via ChatGPT Plus, $200/mo via Pro",
      "enterprise": true
    },
    "estimated_users": "Large via ChatGPT base",
    "market_position": 12,
    "pros": [
      "Open-source under Apache 2.0",
      "Strong with GPT-5 and OpenAI's codex models",
      "Cloud sandbox for parallel task execution",
      "Bundled with ChatGPT Plus subscription"
    ],
    "cons": [
      "Tied to OpenAI models only",
      "Less ergonomic CLI than Claude Code",
      "Usage limits can be hit on Plus tier",
      "Smaller community than Aider or Claude Code"
    ],
    "use_cases": [
      "ChatGPT subscribers wanting CLI coding",
      "Parallel task execution in cloud sandboxes",
      "GPT-5 powered terminal workflows",
      "Open-source CLI agent customization"
    ],
    "supported_ides": ["Terminal", "VS Code (Codex extension)", "Web"],
    "url": "https://developers.openai.com/codex"
  },
  {
    "id": "jetbrains-ai",
    "name": "JetBrains AI Assistant + Junie",
    "developer": "JetBrains",
    "owner": "JetBrains (independent)",
    "country": "Czech Republic",
    "country_code": "cz",
    "cluster": "ide-extension",
    "launch_date": "2023-12-06",
    "description": "Native AI assistant for the JetBrains IDE family, paired with Junie, the autonomous coding agent that explores projects, generates code, and runs tests. Added GPT-5, image attachments, and local model support in 2026.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free tier with basic completion, limited cloud features",
      "pro_price": "$8/mo (AI Pro), $30/mo (AI Ultimate)",
      "enterprise": true
    },
    "estimated_users": "Millions via JetBrains base",
    "market_position": 13,
    "pros": [
      "Deepest integration with IntelliJ/PyCharm/WebStorm/etc.",
      "Junie agent is genuinely capable",
      "Type-aware completions grounded in project context",
      "Bring-your-own-key and local models supported"
    ],
    "cons": [
      "Only for JetBrains IDEs",
      "Quotas burn quickly on cloud features",
      "Less hyped than Cursor/Copilot",
      "Pricing tiers confusing"
    ],
    "use_cases": [
      "Java/Kotlin enterprise development",
      "Python data science in PyCharm",
      "JetBrains-loyal teams",
      "Type-aware refactoring"
    ],
    "supported_ides": ["IntelliJ IDEA", "PyCharm", "WebStorm", "GoLand", "Rider", "CLion", "RubyMine", "PhpStorm"],
    "url": "https://www.jetbrains.com/ai-assistant/"
  },
  {
    "id": "zed",
    "name": "Zed",
    "developer": "Zed Industries",
    "owner": "Zed Industries (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-native",
    "launch_date": "2023-03-23",
    "description": "Rust-built high-performance editor that pivoted hard into AI in 2025-2026 with native agentic editing, the Zeta2 edit prediction model, and the Agent Client Protocol (ACP) co-developed with JetBrains in January 2026 for editor-agnostic agents.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free editor, BYOK or limited free Zeta predictions",
      "pro_price": "$20/mo (Zed Pro)",
      "enterprise": false
    },
    "estimated_users": "Hundreds of thousands",
    "market_position": 14,
    "pros": [
      "Fastest editor on the market (Rust-based)",
      "Open Agent Client Protocol for any agent",
      "Bring any model: Claude, Codex, OpenCode via ACP",
      "Native multi-buffer agentic editing"
    ],
    "cons": [
      "Smaller extension ecosystem than VS Code",
      "Less polished AI than Cursor",
      "macOS-first, Linux/Windows lagging",
      "Niche audience"
    ],
    "use_cases": [
      "Performance-sensitive developers",
      "Rust and systems programming",
      "Multi-agent ACP workflows",
      "macOS power users"
    ],
    "supported_ides": ["Zed (standalone)"],
    "url": "https://zed.dev"
  },
  {
    "id": "tabnine",
    "name": "Tabnine",
    "developer": "Tabnine",
    "owner": "Tabnine (HQ Tel Aviv)",
    "country": "Israel",
    "country_code": "il",
    "cluster": "ide-extension",
    "launch_date": "2018-11-01",
    "description": "One of the original AI code completion tools, now positioned as the privacy-and-compliance-first enterprise option. Discontinued its free Basic tier in April 2025 and pivoted fully to enterprise-grade air-gapped/SaaS deployments with custom-tuned models.",
    "pricing": {
      "free_tier": false,
      "free_details": "Free Basic tier discontinued April 2025",
      "pro_price": "~$12/mo (Dev), ~$39/seat/mo (Enterprise)",
      "enterprise": true
    },
    "estimated_users": "1M+ active",
    "market_position": 15,
    "pros": [
      "Strong air-gapped/on-prem deployment",
      "Privacy-focused with no code retention options",
      "Custom-model training on private codebases",
      "Mature enterprise compliance (SOC 2)"
    ],
    "cons": [
      "Free tier killed in 2025, hurting adoption",
      "Less impressive raw quality than newer rivals",
      "Lost mindshare to Cursor and Copilot",
      "Slow agent feature development"
    ],
    "use_cases": [
      "Regulated industries (finance, healthcare, defense)",
      "Air-gapped enterprise environments",
      "Custom-tuned models on internal code",
      "Privacy-sensitive teams"
    ],
    "supported_ides": ["VS Code", "JetBrains", "Visual Studio", "Eclipse", "Neovim", "Sublime", "Emacs"],
    "url": "https://www.tabnine.com"
  },
  {
    "id": "aider",
    "name": "Aider",
    "developer": "Paul Gauthier / Aider community",
    "owner": "Open source",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2023-05-09",
    "description": "Open-source AI pair programmer in the terminal, beloved for its git-native workflow that auto-commits AI changes with descriptive messages. Supports 100+ languages, /architect mode, repo mapping, and any cloud or local LLM.",
    "pricing": {
      "free_tier": true,
      "free_details": "Fully open source - pay only for LLM API usage",
      "pro_price": "Free tool, BYO-API",
      "enterprise": false
    },
    "estimated_users": "Very large OSS community",
    "market_position": 16,
    "pros": [
      "Best git integration of any coding agent",
      "Works with any LLM (cloud or local)",
      "Architect mode for planning + edit mode for execution",
      "Mature, stable, well-documented"
    ],
    "cons": [
      "Terminal-only, no GUI",
      "API costs can add up with frontier models",
      "Setup learning curve for beginners",
      "No managed cloud sandbox"
    ],
    "use_cases": [
      "Power-user terminal developers",
      "Cost-conscious BYO-key users",
      "Local-model/Ollama enthusiasts",
      "Git-centric workflows"
    ],
    "supported_ides": ["Terminal", "Any editor (file watching)"],
    "url": "https://aider.chat"
  },
  {
    "id": "openhands",
    "name": "OpenHands",
    "developer": "All Hands AI",
    "owner": "All Hands AI (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2024-03-12",
    "description": "Open-source autonomous coding agent (formerly OpenDevin), now under All Hands AI which raised $18.8M Series A. v1.6.0 (March 2026) added Kubernetes support and a Planning Mode beta; runs in sandboxed Docker containers via web GUI, CLI, or SDK.",
    "pricing": {
      "free_tier": true,
      "free_details": "Open source, self-hosted free; pay LLM costs",
      "pro_price": "Cloud version: usage-based",
      "enterprise": true
    },
    "estimated_users": "Largest open agent community",
    "market_position": 17,
    "pros": [
      "Most active open-source agent project",
      "Sandboxed Docker execution for safety",
      "Works with any LLM via OpenRouter or local",
      "Kubernetes-ready in 2026"
    ],
    "cons": [
      "Setup more complex than Claude Code",
      "Quality varies heavily by chosen LLM",
      "GUI rough vs commercial competitors",
      "Resource-heavy on local machines"
    ],
    "use_cases": [
      "Self-hosted autonomous agents",
      "Research and benchmarking",
      "Privacy-conscious agent workflows",
      "Kubernetes-deployed CI agents"
    ],
    "supported_ides": ["Web GUI", "CLI", "SDK", "VS Code extension"],
    "url": "https://openhands.dev"
  },
  {
    "id": "continue-dev",
    "name": "Continue",
    "developer": "Continue Dev",
    "owner": "Continue Dev (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-extension",
    "launch_date": "2023-07-26",
    "description": "Apache 2.0 open-source AI assistant for VS Code and JetBrains; the most popular open-source coding extension in 2026 with 32K+ GitHub stars and 2.4M+ VS Code installs. Pivoted to a 'CI for AI' quality-control angle with source-controlled enforceable AI checks.",
    "pricing": {
      "free_tier": true,
      "free_details": "Fully open source, BYO-LLM",
      "pro_price": "Continue Hub paid tiers (team/enterprise)",
      "enterprise": true
    },
    "estimated_users": "2.4M+ VS Code installs",
    "market_position": 18,
    "pros": [
      "Bring any model (cloud or local Ollama/llama.cpp)",
      "Open source with no lock-in",
      "Works in both VS Code and JetBrains",
      "Customizable autocomplete, chat, agent"
    ],
    "cons": [
      "Quality depends entirely on chosen LLM",
      "Configuration overhead vs turnkey tools",
      "Less polished UX than Cursor",
      "Slower release cycle than commercial rivals"
    ],
    "use_cases": [
      "Local-model enthusiasts (Ollama)",
      "Companies needing self-hosted AI coding",
      "Multi-IDE teams",
      "Customizable CI checks for AI code"
    ],
    "supported_ides": ["VS Code", "JetBrains IDEs", "CLI"],
    "url": "https://www.continue.dev"
  },
  {
    "id": "goose",
    "name": "Goose",
    "developer": "Block (Square)",
    "owner": "Block, Inc.",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2025-01-28",
    "description": "Block's open-source extensible AI agent (Apache 2.0), now hosted under the Linux Foundation's Agentic AI Foundation. Connects any LLM to real-world actions via MCP; 27K+ GitHub stars and considered a free local rival to Claude Code.",
    "pricing": {
      "free_tier": true,
      "free_details": "Fully open source, BYO-LLM",
      "pro_price": "Free, pay only LLM costs",
      "enterprise": false
    },
    "estimated_users": "27K+ GitHub stars",
    "market_position": 19,
    "pros": [
      "Truly extensible via MCP",
      "Backed by Block + Linux Foundation",
      "Works with any LLM",
      "Free alternative to Claude Code"
    ],
    "cons": [
      "Less polished than Claude Code",
      "Smaller user base",
      "Setup complexity for new users",
      "Quality depends on LLM choice"
    ],
    "use_cases": [
      "MCP-based agent workflows",
      "Local-model agentic coding",
      "Teams avoiding Anthropic lock-in",
      "Custom extension builders"
    ],
    "supported_ides": ["Terminal", "Desktop app"],
    "url": "https://block.github.io/goose/"
  },
  {
    "id": "cody",
    "name": "Cody",
    "developer": "Sourcegraph",
    "owner": "Sourcegraph (independent)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-extension",
    "launch_date": "2023-06-13",
    "description": "Sourcegraph's enterprise-focused AI assistant that excels at navigating massive multi-repo codebases via the Sourcegraph Code Intelligence Platform. Cody Free and Pro plans were discontinued in mid-2025; only Cody Enterprise remains.",
    "pricing": {
      "free_tier": false,
      "free_details": "Free and Pro plans discontinued July 2025",
      "pro_price": "$59/user/mo (Enterprise only)",
      "enterprise": true
    },
    "estimated_users": "Enterprise only",
    "market_position": 20,
    "pros": [
      "Unmatched multi-repo enterprise codebase context",
      "Strong code-search backbone (Sourcegraph)",
      "Choice of multiple LLMs",
      "Mature enterprise compliance"
    ],
    "cons": [
      "No more free or individual Pro plans",
      "Enterprise-only is expensive at $59/user",
      "Lost mindshare since Free shutdown",
      "Less agent-forward than Cursor/Claude Code"
    ],
    "use_cases": [
      "Large enterprise monorepos",
      "Multi-repo cross-service navigation",
      "Sourcegraph customers",
      "Code search + AI workflows"
    ],
    "supported_ides": ["VS Code", "JetBrains", "Web"],
    "url": "https://sourcegraph.com/cody"
  },
  {
    "id": "devin",
    "name": "Devin (Cognition)",
    "developer": "Cognition AI",
    "owner": "Cognition AI",
    "country": "USA",
    "country_code": "us",
    "cluster": "specialized",
    "launch_date": "2024-03-12",
    "description": "Cognition's autonomous AI software engineer, dramatically repriced in April 2025 from $500 to $20/month to compete with Cursor/Claude Code. After acquiring Windsurf in late 2025, Cognition reached a $10.2B valuation; Devin 2.0 introduces Interactive Planning and parallel agent execution.",
    "pricing": {
      "free_tier": false,
      "free_details": "No free tier",
      "pro_price": "$20/mo (Core), $500/mo (Team)",
      "enterprise": true
    },
    "estimated_users": "Enterprise focus",
    "market_position": 21,
    "pros": [
      "Fully autonomous parallel agent execution",
      "Devin Wiki auto-generates architecture docs",
      "Cloud-based IDE with interactive planning",
      "Now backed by Windsurf IDE acquisition"
    ],
    "cons": [
      "ACU pricing complex and can spike",
      "Less reliable than marketing implies",
      "Cloud-only, no local mode",
      "Brand controversy from 2024-2025 demos"
    ],
    "use_cases": [
      "Autonomous bug fixing and feature work",
      "Parallel multi-task delegation",
      "Junior-level task automation",
      "Enterprise dev team augmentation"
    ],
    "supported_ides": ["Devin cloud IDE", "Slack", "Linear/Jira integrations"],
    "url": "https://devin.ai"
  },
  {
    "id": "supermaven",
    "name": "Supermaven",
    "developer": "Supermaven",
    "owner": "Anysphere (Cursor)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-extension",
    "launch_date": "2024-03-14",
    "description": "Ultra-low-latency code completion plugin known for its Babble model and 1M-token context. Acquired by Anysphere (Cursor) in November 2024; plugins remain maintained but the core team focuses on Cursor's Tab model.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free tier with basic completions",
      "pro_price": "$10/mo",
      "enterprise": true
    },
    "estimated_users": "Declining post-acquisition",
    "market_position": 22,
    "pros": [
      "Among the lowest-latency completions",
      "1M token context window",
      "Lightweight plugin (works in many editors)",
      "Babble model strong on long sequences"
    ],
    "cons": [
      "Future uncertain after Anysphere acquisition",
      "Development has slowed",
      "Most users migrating to Cursor",
      "Not a full agent, completion-only"
    ],
    "use_cases": [
      "Latency-sensitive autocomplete",
      "Editors not supported by Cursor",
      "Long-context completion needs",
      "Lightweight plugin alternative"
    ],
    "supported_ides": ["VS Code", "JetBrains", "Neovim", "Zed"],
    "url": "https://supermaven.com"
  },
  {
    "id": "void",
    "name": "Void",
    "developer": "Glass Devtools",
    "owner": "Glass Devtools (YC-backed, open source)",
    "country": "USA",
    "country_code": "us",
    "cluster": "ide-native",
    "launch_date": "2025-05-21",
    "description": "Open-source VS Code fork positioned as the privacy-first Cursor alternative. Connects directly to LLM providers without routing through a private backend; supports Agent Mode, Gather Mode, and any model including local ones via Ollama.",
    "pricing": {
      "free_tier": true,
      "free_details": "Fully free and open source, BYO-API",
      "pro_price": "Free, pay only LLM costs",
      "enterprise": false
    },
    "estimated_users": "Growing OSS community",
    "market_position": 23,
    "pros": [
      "No middleman - direct LLM connections",
      "Open source under permissive license",
      "Familiar VS Code interface",
      "Local model support (Ollama)"
    ],
    "cons": [
      "Less polished than Cursor",
      "Smaller team and slower roadmap",
      "No managed cloud features",
      "Quality depends on chosen LLM"
    ],
    "use_cases": [
      "Privacy-focused developers",
      "Local LLM users",
      "Open-source advocates",
      "BYO-API cost optimization"
    ],
    "supported_ides": ["Void (standalone, VS Code fork)"],
    "url": "https://voideditor.com"
  },
  {
    "id": "plandex",
    "name": "Plandex",
    "developer": "Plandex AI",
    "owner": "Plandex (open source)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cli-agent",
    "launch_date": "2024-04-04",
    "description": "Open-source terminal AI development tool designed for very large coding tasks spanning many files and steps. Handles 2M token contexts directly and indexes 20M+ token directories via tree-sitter project maps; cloud version winding down October 2025, now self-hosted only.",
    "pricing": {
      "free_tier": true,
      "free_details": "Open source self-hosted, free",
      "pro_price": "Self-hosted only",
      "enterprise": false
    },
    "estimated_users": "Small but loyal",
    "market_position": 24,
    "pros": [
      "Massive context handling (2M+ tokens)",
      "Cumulative diff sandbox for safety",
      "Branching for trying multiple model approaches",
      "Combines best models from multiple providers"
    ],
    "cons": [
      "Cloud version shut down in 2025",
      "Setup more complex than Claude Code",
      "Smaller ecosystem and community",
      "Self-hosted only adds friction"
    ],
    "use_cases": [
      "Very large multi-file refactors",
      "Long-running coding plans",
      "Multi-model comparative experiments",
      "Self-hosted privacy-sensitive teams"
    ],
    "supported_ides": ["Terminal"],
    "url": "https://plandex.ai"
  },
  {
    "id": "same-new",
    "name": "Same.new",
    "developer": "Same",
    "owner": "Same (Y Combinator)",
    "country": "USA",
    "country_code": "us",
    "cluster": "cloud-ide",
    "launch_date": "2025-02-15",
    "description": "Y Combinator startup specializing in AI-powered pixel-perfect website cloning. Submit a URL and Same recreates the structure, components, styles, and interaction logic in maintainable Next.js/TypeScript code, auto-deployed to Netlify.",
    "pricing": {
      "free_tier": true,
      "free_details": "Free tier with limited clones and Netlify deploys",
      "pro_price": "$20/mo",
      "enterprise": false
    },
    "estimated_users": "Niche",
    "market_position": 25,
    "pros": [
      "Best-in-class for website cloning",
      "Auto-deploys to Netlify",
      "Outputs maintainable Next.js code",
      "Conversational customization after clone"
    ],
    "cons": [
      "Heavily abused by phishing actors (Netcraft warning)",
      "Niche use case beyond cloning",
      "Legal/copyright risks for users",
      "Limited beyond UI replication"
    ],
    "use_cases": [
      "Inspiration and rebuilding existing sites",
      "Migrating legacy sites to Next.js",
      "Designer/developer workflow speedups",
      "Quick landing page replication"
    ],
    "supported_ides": ["Same (browser-based)"],
    "url": "https://same.new"
  }
];
