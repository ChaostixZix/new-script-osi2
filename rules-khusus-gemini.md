# Using Gemini CLI for Targeted Feature Analysis

- Please use targeted analysis before implementing task - focus on SPECIFIC functions/features, NOT entire codebase
- ALWAYS check if @documentation.md existed and is uptodate, if it exists, please refer using that and don't reindex the codebase, but if its not uptodate then use Gemini CLI first when you try to understand this codebase and then update the documentation.md
- Everytime you add a new knowledge, please tell GEMINI.CLI to update the documentation.md, but give context, so gemini_cli doesnt reindex all the codebase again (this will cause to eat time)
- If Gemini CLI fails, retry up to 3 times before falling back to other methods
- **PRIORITIZE SPECIFIC FEATURE ANALYSIS over full codebase analysis**

When analyzing codebases, focus on SPECIFIC functions, features, or components rather than analyzing everything at once. Use targeted, detailed prompts that provide clear context and specific requirements.

**IMPORTANT**: Use detailed, specific prompts for better Gemini CLI communication and context understanding.

## Targeted Analysis Strategy
**ALWAYS prioritize specific feature analysis:**
1. **Identify specific function/feature** you need to understand or implement
2. **Target relevant files/directories** only for that feature
3. **Use detailed, specific prompts** with clear context and requirements
4. **Avoid full codebase analysis** unless absolutely necessary

## Retry Strategy
If a Gemini CLI command fails:
1. First attempt: Try the original command
2. Second attempt: Retry the same command (network/API issues)
3. Third attempt: Retry with simplified prompt or smaller scope
4. Fourth attempt: Fall back to manual file reading only if all Gemini attempts fail

## File and Directory Inclusion Syntax

Use the `@` syntax to include SPECIFIC files and directories relevant to your target feature. The paths should be relative to WHERE you run the gemini command.

**FOCUS ON RELEVANT FILES ONLY - NOT ENTIRE CODEBASE**

### Examples:

**Target specific feature files:**
gemini -p "@src/auth/ @middleware/auth.js I need to understand how JWT authentication works in this app. Please explain: 1) How tokens are generated and validated, 2) What middleware is used, 3) How protected routes work, 4) Any refresh token logic"

**Analyze specific component:**
gemini -p "@components/UserProfile.jsx @hooks/useUser.js I'm working on user profile functionality. Please analyze: 1) How user data is fetched and managed, 2) What props/state are used, 3) How profile updates work, 4) Any validation or error handling"

**Target API endpoints:**
gemini -p "@routes/api/users.js @controllers/userController.js @models/User.js I need to understand the user management API. Please explain: 1) All available endpoints, 2) Request/response formats, 3) Validation rules, 4) Database operations"

**Focus on specific functionality:**
gemini -p "@src/payment/ @utils/stripe.js I'm implementing payment processing. Please analyze: 1) How payments are handled, 2) What payment methods are supported, 3) Error handling for failed payments, 4) Webhook implementation"

## Detailed Prompt Guidelines

**Always provide specific context and requirements:**

### ✅ GOOD - Detailed and Specific:
```bash
gemini -p "@src/chat/ @components/ChatRoom.jsx I'm implementing real-time chat functionality. Please analyze and explain: 1) How WebSocket connections are established and maintained, 2) Message format and data structure, 3) How typing indicators work, 4) Room joining/leaving logic, 5) Any authentication for chat access"
```

### ❌ BAD - Vague and General:
```bash
gemini -p "@src/ Analyze the codebase"
```

### ✅ GOOD - Focused Feature Analysis:
```bash
gemini -p "@components/DataTable.jsx @hooks/useTableData.js I need to add sorting and filtering to the data table. Please explain: 1) Current data fetching logic, 2) How table state is managed, 3) Existing sorting/filtering if any, 4) Prop structure and data flow, 5) Best approach to add new sorting columns"
```

### ✅ GOOD - Implementation Verification:
```bash
gemini -p "@src/auth/ @middleware/ I need to verify authentication security. Please check: 1) Are passwords properly hashed with salt?, 2) Is rate limiting implemented for login attempts?, 3) Are JWTs properly validated on protected routes?, 4) Any CSRF protection?, 5) Session management approach"
```

## When to Use Gemini CLI

**PRIORITIZE for specific feature analysis:**
- Understanding SPECIFIC functions, components, or features
- Analyzing targeted file groups related to one functionality
- Verifying specific implementation patterns
- Getting context for implementing similar features
- Understanding data flow for particular features

**Use ONLY when necessary for broader analysis:**
- Creating comprehensive documentation (after specific analysis)
- Understanding overall architecture (rare cases)
- Project structure overview (initial setup only)

## Mandatory Retry Protocol
For ANY failed Gemini command, you MUST:
1. **Attempt 1**: Execute the original gemini command
2. **Attempt 2**: If failed, retry the exact same command (may be temporary network/API issue)
3. **Attempt 3**: If failed again, try with a simpler or more focused prompt
4. **Attempt 4**: Only after 3 failures, fall back to manual file reading

Example retry sequence:
```bash
# Attempt 1
gemini -p "@src/auth/ @middleware/auth.js Explain JWT authentication implementation: token generation, validation, middleware usage, and protected routes"

# Attempt 2 (if failed)
gemini -p "@src/auth/ @middleware/auth.js Explain JWT authentication implementation: token generation, validation, middleware usage, and protected routes"

# Attempt 3 (if failed again) - Simplified
gemini -p "@src/auth/ How does authentication work in this codebase?"

# Attempt 4: Manual fallback only if all 3 attempts failed
```

## Important Notes

- **Target specific features/functions** rather than analyzing entire codebase
- **Provide detailed, specific prompts** with clear context and numbered requirements
- Paths in @ syntax are relative to your current working directory when invoking gemini
- The CLI will include file contents directly in the context
- No need for --yolo flag for read-only analysis
- **Always explain what you're trying to accomplish** and what specific information you need
- **Break down complex analysis** into specific, focused questions
- **Provide context about your implementation goals** in the prompt

## Full Codebase Analysis (When Necessary)

**Use full codebase analysis ONLY when:**
- You don't know where specific features are located
- You need to discover existing implementations
- Initial project exploration
- Finding related files for unknown features

### Discovery and Exploration Examples:

**Discover authentication system:**
```bash
gemini -a -p "Please explain how authentication works in this app. I need to understand: 1) What authentication method is used (JWT, sessions, etc), 2) Where are auth-related files located, 3) How login/logout works, 4) How protected routes are handled, 5) Any middleware or guards used"
```

**Find specific feature location:**
```bash
gemini -a -p "I need to find where user profile management is implemented. Please locate: 1) Profile-related components/pages, 2) API endpoints for profile operations, 3) Database models for user data, 4) Any validation or update logic"
```

**Discover payment implementation:**
```bash
gemini -a -p "Help me find payment processing implementation. Please identify: 1) Payment gateway used (Stripe, PayPal, etc), 2) Payment-related files and components, 3) How transactions are handled, 4) Any webhook implementations, 5) Order/invoice management"
```

**Find specific functionality:**
```bash
gemini -a -p "I need to locate file upload functionality. Please find: 1) Upload components or forms, 2) Backend upload handlers, 3) Storage configuration (local/cloud), 4) File validation and processing, 5) Any image resizing or processing"
```

**Explore project structure:**
```bash
gemini -a -p "Please provide an overview of this project structure. I need to understand: 1) Main application architecture, 2) Key directories and their purposes, 3) Technology stack used, 4) How frontend and backend are organized, 5) Database setup and models"
```

**Discover API structure:**
```bash
gemini -a -p "Help me understand the API structure. Please explain: 1) All available API endpoints, 2) Authentication requirements for each, 3) Request/response formats, 4) Error handling patterns, 5) API documentation or OpenAPI specs"
```

### Two-Phase Approach (Recommended):

**Phase 1 - Discovery:**
```bash
gemini -a -p "I need to implement real-time notifications. Please help me discover: 1) Are there existing notification systems?, 2) What WebSocket or SSE implementations exist?, 3) Where are notification-related files located?, 4) How are notifications stored/managed?, 5) Any existing UI components for notifications"
```

**Phase 2 - Targeted Analysis:**
```bash
gemini -p "@src/notifications/ @components/NotificationCenter.jsx @api/notifications.js Now I found the notification files. Please analyze in detail: 1) How notifications are created and sent, 2) WebSocket connection handling, 3) Notification persistence and retrieval, 4) UI components and their props, 5) Any real-time update mechanisms"
```

### Full Codebase Commands:

**Complete project analysis:**
```bash
gemini -a -p "Provide comprehensive project analysis including architecture, features, and implementation details"
```

**Using current directory:**
```bash
gemini -p "@./ Analyze this entire project structure and explain the main features implemented"
```

**Multiple root directories:**
```bash
gemini -p "@src/ @api/ @components/ @pages/ Analyze the complete application structure and data flow"
```

## Important Guidelines for Full Analysis:

- **Use `-a` flag** for complete project analysis
- **Still be specific** about what you want to learn even with full analysis
- **Follow with targeted analysis** once you know file locations
- **Break down complex questions** into numbered requirements
- **Provide context** about what you're trying to accomplish

## When NOT to Use Full Analysis:

- When you already know the relevant files
- For simple feature modifications
- When working with well-documented codebases
- For performance-critical analysis (target specific files instead)

