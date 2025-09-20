# User Rules
- dont be detailed n readme, just put concise minimal instruction, this app is for me only
- don't start your own server unless sepcifically asked to, never start npm or bun (bun run or npm start or npm run) let me do it, don't test it yourself


# Using Gemini CLI for Large Codebase Analysis

- Please use codebase analysis before implementing task
- ALWAYS check if @documentation.md existed and is uptodate, if it exists, please refer using that and don't reindex the codebase, but if its not uptodate then use Gemini CLI first when you try to understand this codebase and then update the documentation.md
- Everytime you add a new knowledge, please tell GEMINI.CLI to update the documentation.md, but give context, so gemini_cli doesnt reindex all the codebase again (this will cause to eat time
- If Gemini CLI fails, retry up to 3 times before falling back to other methods

When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

**IMPORTANT**: Always add `--timeout 60` flag to Gemini CLI commands to set a maximum timeout of 1 minute.

## Retry Strategy
If a Gemini CLI command fails:
1. First attempt: Try the original command
2. Second attempt: Retry the same command (network/API issues)
3. Third attempt: Retry with simplified prompt or smaller scope
4. Fourth attempt: Fall back to manual file reading only if all Gemini attempts fail

## File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
  gemini command:

### Examples:

**Single file analysis:**
gemini --timeout 60 -p "@src/main.py Explain this file's purpose and structure"

Multiple files:
gemini --timeout 60 -p "@package.json @src/index.js Analyze the dependencies used in the code"

Entire directory:
gemini --timeout 60 -p "@src/ Summarize the architecture of this codebase"

Multiple directories:
gemini --timeout 60 -p "@src/ @tests/ Analyze test coverage for the source code"

Current directory and subdirectories:
gemini --timeout 60 -p "@./ Give me an overview of this entire project"

# Or use -a flag:
gemini --timeout 60 -a -p "Analyze the project structure and dependencies"

## Implementation Verification Examples

Check if a feature is implemented:
gemini --timeout 60 -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

Verify authentication implementation:
gemini --timeout 60 -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

Check for specific patterns:
gemini --timeout 60 -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

Verify error handling:
gemini --timeout 60 -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

Check for rate limiting:
gemini --timeout 60 -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

Verify caching strategy:
gemini --timeout 60 -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

Check for specific security measures:
gemini --timeout 60 -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

Verify test coverage for features:
gemini --timeout 60 -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

## When to Use Gemini CLI

ALWAYS use gemini -p as the first approach for:
- ANY codebase analysis or understanding task
- Analyzing entire codebases or large directories
- Comparing multiple large files
- Understanding project-wide patterns or architecture
- Working with files totaling more than 100KB
- Verifying if specific features, patterns, or security measures are implemented
- Checking for the presence of certain coding patterns across the entire codebase
- Creating comprehensive documentation
- Understanding project structure and dependencies

## Mandatory Retry Protocol
For ANY failed Gemini command, you MUST:
1. **Attempt 1**: Execute the original gemini command
2. **Attempt 2**: If failed, retry the exact same command (may be temporary network/API issue)
3. **Attempt 3**: If failed again, try with a simpler or more focused prompt
4. **Attempt 4**: Only after 3 failures, fall back to manual file reading

Example retry sequence:
```bash
# Attempt 1
gemini --timeout 60 -a -p "Analyze this codebase comprehensively"

# Attempt 2 (if failed)
gemini --timeout 60 -a -p "Analyze this codebase comprehensively"

# Attempt 3 (if failed again) 
gemini --timeout 60 -p "@app/ @lib/ @components/ Analyze the main application structure"

# Attempt 4: Manual fallback only if all 3 attempts failed
```

## Important Notes

- Paths in @ syntax are relative to your current working directory when invoking gemini
- The CLI will include file contents directly in the context
- No need for --yolo flag for read-only analysis
- Gemini's context window can handle entire codebases that would overflow Claude's context
- When checking implementations, be specific about what you're looking for to get accurate results
