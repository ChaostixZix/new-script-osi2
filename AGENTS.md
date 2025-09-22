# User Rules
- dont be detailed n readme, just put concise minimal instruction, this app is for me only
- don't start your own server unless sepcifically asked to, never start npm or bun (bun run or npm start or npm run) let me do it, don't test it yourself

# Using Gemini CLI for Code Analysis Only

## When to Use Gemini CLI

**USE GEMINI CLI FOR:**
- **Understanding function implementations** - how a function works internally
- **Checking if functions/methods exist** - searching for specific functionality
- **Analyzing code logic** - understanding complex algorithms or business logic
- **Code relationships** - how different modules interact
- **Architecture analysis** - understanding design patterns and structure
- **Finding specific implementations** - locating where features are coded
- **Code review** - analyzing code quality and potential issues
- **Understanding dependencies** - how modules depend on each other

**DO NOT USE GEMINI CLI FOR:**
- **Listing files and folders** - use `ls`, `find`, or `tree` instead
- **Simple file reading** - use `cat` or `less` for quick file viewing
- **Directory structure** - use standard shell commands
- **File existence checks** - use `test`, `ls`, or `find`
- **Basic file operations** - use standard Unix commands
- **Simple grep searches** - use `grep` directly for keyword searches

## Examples

### When to Use Standard Commands (NOT Gemini CLI)

**Listing files:**
```bash
ls -la src/           # ✅ Use ls for listing files
find . -name "*.js"   # ✅ Use find for searching files
tree src/             # ✅ Use tree for directory structure
```

**Quick file viewing:**
```bash
cat package.json      # ✅ Use cat for simple file reading
head README.md        # ✅ Use head for file preview
grep "TODO" -r .      # ✅ Use grep for simple text search
```

**File checks:**
```bash
test -f config.json && echo "exists"  # ✅ Use test for existence
ls src/components/                     # ✅ Use ls for directory contents
```

### When to Use Gemini CLI (For Analysis)

**Understanding function implementation:**
```bash
gemini -p "@src/auth/login.js Explain how the login function is implemented and what validation it performs"
```

**Checking if functionality exists:**
```bash
gemini -a -p "Is there a password reset function implemented? If yes, where and how does it work?"
```

**Analyzing code logic:**
```bash
gemini -p "@src/payment/stripe.js Explain the payment processing logic and error handling"
```

**Understanding architecture:**
```bash
gemini -a -p "Analyze the application architecture and explain the design patterns used"
```

**Finding specific implementations:**
```bash
gemini -a -p "Where is user authentication implemented and how does the JWT token flow work?"
```

## Documentation Update Protocol

- ALWAYS check if @documentation.md exists and is up-to-date
- If documentation exists and current, refer to it instead of re-indexing
- If not up-to-date, use Gemini CLI for analysis first, then update documentation.md
- When updating documentation.md, provide context to avoid full re-indexing

**Updating documentation after analysis:**
```bash
gemini -p "@documentation.md Add information about the new payment module implementation in src/payment/"
```

## Decision Tree for Tool Selection

```
Need to work with files/code?
├─ Simple task (list, read, check)?
│  └─ Use standard Unix commands (ls, cat, grep, find)
└─ Analytical task (understand, analyze, review)?
   └─ Use Gemini CLI
```

## Practical Examples

### Task: "Show me what's in the src folder"
```bash
ls -la src/  # ✅ Simple listing - use ls
```

### Task: "Check if there's a user authentication function"
```bash
gemini -a -p "Is there a user authentication function? Explain how it works"  # ✅ Analysis - use Gemini
```

### Task: "Show me the package.json file"
```bash
cat package.json  # ✅ Simple reading - use cat
```

### Task: "Explain how the database connection is implemented"
```bash
gemini -p "@config/database.js @models/ Explain the database connection implementation and model relationships"  # ✅ Analysis - use Gemini
```

### Task: "Find all JavaScript files"
```bash
find . -name "*.js"  # ✅ Simple search - use find
```

### Task: "Understand the API routing structure"
```bash
gemini -p "@routes/ @app.js Analyze the API routing structure and middleware chain"  # ✅ Analysis - use Gemini
```

## Retry Strategy (Only for Gemini CLI)
When using Gemini CLI for analysis:
1. First attempt: Try the original command
2. Second attempt: Retry if network/API issue
3. Third attempt: Simplify the prompt
4. Fall back to manual analysis if needed

## Summary
- **Simple tasks** = Standard Unix commands (faster, more efficient)
- **Analytical tasks** = Gemini CLI (better understanding, AI-powered insights)
- Choose the right tool for the right job
- Don't over-engineer simple operations
