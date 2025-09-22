# CLAUDE AGENT INSTRUCTIONS

## STRICT RULE: ALWAYS USE GEMINI CLI FOR CONTEXT

When working on any task that requires understanding code, files, or project context, you MUST:

1. **NEVER read files directly** using tools like `cat`, `head`, `tail`, or similar commands
2. **NEVER analyze code or files independently** 
3. **ALWAYS use Gemini CLI first** to get context and understanding
4. **STRICTLY follow this workflow:**
   - Use `gemini` command to get context about the codebase/files
   - Ask Gemini specific questions about the code structure, functionality, or requirements
   - Only proceed with implementation after getting clear guidance from Gemini

## Required Workflow

### Before any code changes:
```bash
# Get overall project context
gemini "Please analyze this codebase and explain its structure and main functionality"

# Get specific context for the task
gemini "I need to [describe your task]. What files should I modify and what approach should I take?"

# Get implementation guidance
gemini "Please provide step-by-step instructions for implementing [specific feature/fix]"
```

### During implementation:
- If you need to understand existing code: Ask Gemini
- If you're unsure about implementation details: Ask Gemini  
- If you encounter errors or issues: Consult Gemini first

### Example Commands:
```bash
# Instead of: cat src/main.py
# Use: gemini "Please explain what the main.py file does and its key functions"

# Instead of: analyzing code structure yourself  
# Use: gemini "What is the architecture of this project and how do the components interact?"

# Before making changes:
# Use: gemini "I want to add feature X. What files need to be modified and what's the best approach?"
```

## Exception Rules
The ONLY exceptions where you can read files directly are:
1. Reading this @CLAUDE.md file itself
2. Reading basic configuration files like package.json, requirements.txt for dependency information
3. Reading simple text files that don't contain code logic

## Enforcement
- This rule applies to ALL tasks: debugging, feature development, code analysis, refactoring
- Always start every coding session by getting context from Gemini
- Never assume you understand the codebase without Gemini's input
- When in doubt, ask Gemini

## Remember
You are not allowed to interpret or analyze code on your own. Gemini CLI is your primary source of truth for understanding any codebase or implementation requirements.
