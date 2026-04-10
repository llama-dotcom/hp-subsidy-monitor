const DATA_SYNERGIES = [
  {
    "id": "research-to-code",
    "title": "Research → Code Pipeline",
    "icon": "🔬",
    "tools": ["Perplexity AI", "Claude", "Claude Code"],
    "description": "Use Perplexity for research and fact-finding, Claude for planning and architecture, then Claude Code for implementation. Best for building new features from scratch.",
    "steps": [
      "Research the topic with Perplexity AI — gather docs, APIs, best practices",
      "Paste findings into Claude chat to design architecture and plan the approach",
      "Use Claude Code to implement the solution with full codebase context",
      "Review and iterate with Claude Code using /review or manual feedback"
    ]
  },
  {
    "id": "code-review-workflow",
    "title": "Multi-AI Code Review",
    "icon": "🔍",
    "tools": ["Claude Code", "GitHub Copilot", "ChatGPT"],
    "description": "Get diverse perspectives on your code by using multiple AI reviewers. Each model catches different types of issues.",
    "steps": [
      "Write code with Claude Code or Copilot for initial implementation",
      "Ask Claude Code to review for architecture, security, and edge cases",
      "Paste critical sections into ChatGPT for a second opinion on logic",
      "Use Copilot inline suggestions for micro-optimizations while editing"
    ]
  },
  {
    "id": "debug-pipeline",
    "title": "AI-Powered Debugging",
    "icon": "🐛",
    "tools": ["Claude Code", "Perplexity AI", "Cursor"],
    "description": "Combine multiple AI tools for faster debugging. Use each tool's strengths: codebase awareness, web search, and inline editing.",
    "steps": [
      "Start with Claude Code — describe the bug, let it search the codebase",
      "If the error involves a library or API, search Perplexity for known issues",
      "Use Cursor for rapid inline edits while testing fixes in real-time",
      "Let Claude Code write tests to prevent regression"
    ]
  },
  {
    "id": "documentation-workflow",
    "title": "Auto-Documentation Pipeline",
    "icon": "📝",
    "tools": ["Claude Code", "Claude", "Gemini"],
    "description": "Generate comprehensive documentation by combining code analysis with natural language generation.",
    "steps": [
      "Use Claude Code to analyze the codebase structure and extract key patterns",
      "Feed the analysis into Claude to generate user-facing documentation",
      "Use Gemini with its large context window for reviewing entire doc sets",
      "Claude Code can update inline code comments and JSDoc/docstrings"
    ]
  },
  {
    "id": "learning-workflow",
    "title": "Accelerated Learning",
    "icon": "🎓",
    "tools": ["Perplexity AI", "Claude", "ChatGPT"],
    "description": "Learn new technologies faster by combining AI tools for research, explanation, and practice.",
    "steps": [
      "Ask Perplexity for the latest tutorials, docs, and community recommendations",
      "Use Claude for deep explanations — ask it to explain concepts step by step",
      "Practice with ChatGPT by asking it to quiz you or generate exercises",
      "Build a small project with Claude Code to apply what you learned"
    ]
  },
  {
    "id": "rapid-prototyping",
    "title": "Rapid Prototyping",
    "icon": "🚀",
    "tools": ["Claude", "Claude Code", "Replit"],
    "description": "Go from idea to working prototype in hours. Use Claude for design, Claude Code for implementation, Replit for instant deployment.",
    "steps": [
      "Describe your idea to Claude — get architecture, tech stack, and file structure",
      "Use Claude Code to generate the full project with all files",
      "Deploy instantly on Replit for testing and sharing with stakeholders",
      "Iterate based on feedback using Claude Code for rapid changes"
    ]
  },
  {
    "id": "data-analysis",
    "title": "AI-Assisted Data Analysis",
    "icon": "📊",
    "tools": ["Claude", "ChatGPT", "Perplexity AI"],
    "description": "Combine AI tools for analyzing data, generating insights, and creating reports.",
    "steps": [
      "Upload data to Claude — it can analyze CSVs, JSON, and structured data",
      "Use ChatGPT's Code Interpreter for complex calculations and visualizations",
      "Cross-reference findings with Perplexity for market context and benchmarks",
      "Generate the final report with Claude for clear, well-structured writing"
    ]
  },
  {
    "id": "migration-workflow",
    "title": "Codebase Migration",
    "icon": "🔄",
    "tools": ["Claude Code", "Cursor", "Gemini"],
    "description": "Migrate between frameworks, languages, or architectures using multiple AI tools for safety and speed.",
    "steps": [
      "Use Gemini (large context) to analyze the entire old codebase at once",
      "Plan the migration strategy with Claude Code — file by file approach",
      "Execute migrations in Cursor for real-time preview of changes",
      "Run Claude Code to verify, test, and fix any issues post-migration"
    ]
  }
];
