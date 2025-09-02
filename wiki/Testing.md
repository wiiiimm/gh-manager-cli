# Testing

This page outlines the testing strategy, current test coverage, and future testing goals for the gh-manager-cli project.

## Test Infrastructure

### Testing Framework
- **Test Runner**: Vitest v2.1.9
- **Testing Library**: ink-testing-library (for React/Ink components)
- **Coverage Tool**: @vitest/coverage-v8
- **Assertion Library**: Vitest's built-in expect API

### Test File Structure
```
tests/
├── config.test.ts          # Configuration management tests
├── github.test.ts          # GitHub API helper tests
├── utils.test.ts           # Utility function tests
├── apolloMeta.test.ts      # Apollo cache metadata tests
└── ui/
    ├── RepoRow.test.tsx    # Repository row component
    ├── RepoListHeader.test.tsx  # Repository list header
    ├── FilterInput.test.tsx     # Filter input component
    ├── SlowSpinner.test.tsx     # Loading spinner component
    ├── DeleteModal.test.tsx     # Delete confirmation modal
    ├── ArchiveModal.test.tsx    # Archive/unarchive modal
    └── LogoutModal.test.tsx     # Logout confirmation modal
```

## Running Tests

### Basic Commands
```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run tests in watch mode (if configured)
pnpm vitest

# Run specific test file
pnpm vitest tests/config.test.ts

# Run tests matching a pattern
pnpm vitest --grep "config"
```

### Coverage Report
After running `pnpm test:coverage`, you'll see:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage
- Uncovered line numbers for each file

## Current Test Coverage

### Summary Statistics
- **Total Test Files**: 11
- **Total Tests**: 82
- **Overall Coverage**: ~7.62% (low due to untested main components)
- **Utilities Coverage**: 100% (4/4 utilities tested)
- **Component Coverage**: 64% (7/11 components tested)

For detailed test coverage by category, see the [full testing documentation](../docs/TESTING.md).

## Testing Strategies

### 1. Mocking Strategy for useInput Components
Components using Ink's `useInput` hook require special handling:

```typescript
// Mock the useInput hook to avoid stdin.ref issues
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn()
  };
});

// In tests, configure mock behavior
beforeEach(async () => {
  const ink = await import('ink');
  mockUseInput = (ink as any).useInput;
  mockUseInput.mockReset();
});
```

### 2. TextInput Component Mocking
For components using `ink-text-input`:

```typescript
vi.mock('ink-text-input', async () => {
  const React = await import('react');
  const { Text } = await import('ink');
  
  return {
    default: vi.fn(({ value, placeholder, onChange, onSubmit }: any) => {
      // Mock implementation
      return React.createElement(Text, {}, value || placeholder);
    })
  };
});
```

### 3. Component Rendering Tests
Focus on testing:
- UI rendering and display
- Conditional rendering
- Props handling
- Basic state changes

## Future Testing Goals

For detailed information about future testing goals, see the [full testing documentation](../docs/TESTING.md#future-testing-goals).

## Known Limitations

### 1. useInput Hook Testing
- Cannot fully test keyboard interactions due to stdin.ref incompatibility
- Limited to testing component rendering and basic callbacks
- Recommend integration/e2e tests for full keyboard flow

### 2. Async State Updates
- React state updates in tests may not reflect immediately
- Need careful handling of async operations
- May require `waitFor` utilities or timers

### 3. Terminal UI Testing
- Limited ability to test terminal-specific features
- Box dimensions and wrapping behavior
- Color output verification

### 4. GraphQL Testing
- Complex to mock entire GraphQL responses
- Need to maintain mock data in sync with schema
- Pagination and cursor-based queries are challenging

## Related Pages

- [Development](Development.md) - Development workflow and technical details
- [Features](Features.md) - Core features and capabilities

