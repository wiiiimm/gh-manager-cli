# Terminal Colors Guide

## Understanding Terminal Colors

Terminal applications use a **palette-based color system** that adapts to user preferences. Unlike web applications with fixed hex colors, terminal colors are **semantic references** that get translated by the terminal emulator.

## The Semantic Color System

### Core Concept
Instead of saying "use #00FF00", we say "use green". The terminal decides what "green" means based on the user's theme.

### Semantic Color Meanings

| Semantic Name | Typical Usage | Meaning |
|--------------|--------------|----------|
| **primary** | Main content text | The most important text |
| **secondary** | Supporting text | Less important information |
| **accent** | Interactive elements | Draws attention, clickable |
| **success** | Positive states | Operation succeeded |
| **warning** | Caution needed | Requires attention |
| **error** | Problems/failures | Something went wrong |
| **muted** | De-emphasized | Background information |
| **selected** | Current selection | Active/focused item |
| **disabled** | Unavailable | Cannot be interacted with |

## Mapping Semantics to Terminal Colors

### Recommended Mappings

```typescript
const semanticColors = {
  primary:    'white',      // Main text
  secondary:  'gray',       // Supporting text  
  accent:     'cyan',       // Interactive/special
  success:    'green',      // Positive feedback
  warning:    'yellow',     // Attention needed
  error:      'red',        // Errors/problems
  muted:      'gray+dim',   // Background info
  selected:   'cyan',       // Current selection
  disabled:   'gray+dim',   // Unavailable items
  info:       'blue',       // Informational
}
```

### Adaptive Behavior

These semantic colors automatically adapt:

| Semantic | Dark Terminal | Light Terminal |
|----------|--------------|----------------|
| primary | Light gray/white | Dark gray/black |
| secondary | Medium gray | Medium gray |
| accent | Bright cyan | Dark cyan |
| muted | Dim gray | Light gray |

## How to Communicate Colors

### ✅ PREFERRED: Use Semantic Names

**Best way to communicate:**
- "Make the heading use **primary** color"
- "Change selected items to **accent** color"
- "Use **muted** for timestamps"
- "Show errors in **error** color"
- "Make disabled items **muted**"

**Why this works:**
- Clear intent
- Theme-agnostic
- Consistent meaning
- Easy to understand

### ✅ GOOD: Describe the Purpose

**Purpose-based communication:**
- "Make it stand out more" → Use **accent** or **primary**
- "Make it less prominent" → Use **muted** or **secondary**
- "Show it's interactive" → Use **accent**
- "Show it's dangerous" → Use **error**
- "Show it needs attention" → Use **warning**

### ⚠️ OKAY: Use Color Names When Needed

**When specific colors are needed:**
- "Use cyan for links" (when matching a convention)
- "Make private repos yellow" (specific to GitHub)
- "Use the language color from GitHub" (external data)

### ❌ AVOID: Hardcoded Values

**Don't use:**
- "Make it #00FFFF"
- "Use RGB(0, 255, 255)"
- "Make it exactly this shade"

## Practical Examples

### Repository List Item

```typescript
// Semantic description:
{
  number:      'muted',      // "12."
  name:        'primary',    // "owner/repo"
  private:     'warning',    // "Private" badge
  archived:    'muted',      // "Archived" badge
  selected:    'accent',     // When highlighted
  description: 'secondary',  // Repo description
  metadata:    'muted',      // Stars, language, date
}
```

**How to communicate this:**
- "Use **primary** for repo names"
- "Make numbers **muted**"
- "Show private badge as **warning**"
- "Selected items should be **accent**"

### Status Messages

```typescript
{
  loading:  'warning',   // "Loading..."
  success:  'success',   // "✓ Completed"
  error:    'error',     // "✗ Failed"
  info:     'info',      // "ℹ 50 repos found"
}
```

**How to communicate:**
- "Show loading state as **warning**"
- "Success messages in **success** color"
- "Error messages in **error** color"

## Implementation in Code

### Using Semantic Mapping

```tsx
// Define semantic mappings
const colors = {
  primary: undefined,  // Use terminal default
  secondary: 'gray',
  accent: 'cyan',
  muted: 'gray',
  error: 'red',
  warning: 'yellow',
  success: 'green',
};

// Use semantically
<Text color={colors.primary}>Repository Name</Text>
<Text color={colors.muted} dimColor>Updated 2 days ago</Text>
<Text color={colors.accent}>→ Selected Item</Text>
```

### Modifiers for Emphasis

```tsx
// Emphasis levels
<Text color={colors.primary} bold>Very Important</Text>
<Text color={colors.primary}>Normal Important</Text>
<Text color={colors.secondary}>Less Important</Text>
<Text color={colors.muted} dimColor>Least Important</Text>
```

## Quick Reference Card

### Semantic → Terminal Color → Meaning

| Say This | Maps To | Use For |
|----------|---------|---------|
| **primary** | `white` or `undefined` | Main content |
| **secondary** | `gray` | Supporting info |
| **accent** | `cyan` | Interactive/special |
| **muted** | `gray` + `dimColor` | Background info |
| **success** | `green` | Positive states |
| **warning** | `yellow` | Needs attention |
| **error** | `red` | Problems |
| **info** | `blue` | Information |
| **selected** | `cyan` + `bold` | Current selection |

## Communication Templates

### Requesting Changes

Instead of: "Make the text #888888"
Say: "Make the text **secondary**"

Instead of: "Use bright blue"
Say: "Use **accent** color"

Instead of: "Make it darker"
Say: "Make it **muted**"

Instead of: "Make it pop"
Say: "Make it **accent** with bold"

### Describing Problems

Instead of: "The gray is too light"
Say: "The **secondary** text needs more contrast"

Instead of: "Can't see the selection"
Say: "The **selected** state needs to be more prominent"

Instead of: "Too many colors"
Say: "Simplify to **primary** and **secondary** only"

## Benefits of Semantic Colors

1. **Theme Independence**: Works with any terminal theme
2. **Accessibility**: Users can adjust their terminal for their needs
3. **Consistency**: Same semantic meaning everywhere
4. **Maintenance**: Easy to update color scheme globally
5. **Communication**: Clear intent without technical details

## Summary

When discussing colors, think about **what the color means**, not what it looks like:

- **Primary**: Most important
- **Secondary**: Supporting  
- **Accent**: Special/interactive
- **Muted**: De-emphasized
- **Success/Warning/Error**: States

This semantic approach ensures your terminal UI looks good in any theme and is accessible to all users.