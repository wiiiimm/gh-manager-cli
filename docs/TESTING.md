# Testing Documentation for gh-manager-cli

## Overview
This document outlines the testing strategy, current test coverage, and future testing goals for the gh-manager-cli project.

## Table of Contents
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Current Test Coverage](#current-test-coverage)
- [Testing Strategies](#testing-strategies)
- [Future Testing Goals](#future-testing-goals)
- [Known Limitations](#known-limitations)

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

### Detailed Test Coverage by Category

#### 1. Configuration Tests (`config.test.ts`)
**Coverage**: 100% | **Tests**: 23

Testing:
- `getConfigPath()` - Returns correct config file path
- `readConfig()` - Reads and parses configuration files
- `writeConfig()` - Writes configuration with proper permissions
- `getTokenFromEnv()` - Retrieves tokens from environment variables
- `getStoredToken()` - Gets stored authentication tokens
- `storeToken()` - Persists tokens securely
- `clearStoredToken()` - Removes tokens while preserving other settings
- `getUIPrefs()` - Retrieves UI preferences
- `storeUIPrefs()` - Persists UI preferences with merging

#### 2. Utility Function Tests (`utils.test.ts`)
**Coverage**: 100% | **Tests**: 13

Testing:
- `truncate()` function:
  - Strings shorter than max length
  - Strings longer than max length with ellipsis
  - Exact length strings
  - Default max value (80 chars)
  - Empty strings
  - Very small max values
- `formatDate()` function:
  - "today" formatting
  - "yesterday" formatting
  - "X days ago" (within a week)
  - "X weeks ago" (within a month)
  - "X months ago" (within a year)
  - "X years ago"
  - Future date handling

#### 3. GitHub API Tests (`github.test.ts`)
**Coverage**: 4.91% (mostly untested) | **Tests**: 8

Testing:
- `makeClient()` - Creates GraphQL client with authentication
- `getViewerLogin()` - Fetches authenticated user's login
- `fetchViewerOrganizations()` - Retrieves user's organizations
- Handling of null values in organization names
- Empty organization lists

**Not Tested**: Most GraphQL query functions (fetchViewerReposPage, etc.)

#### 4. Apollo Cache Tests (`apolloMeta.test.ts`)
**Coverage**: 100% | **Tests**: 2

Testing:
- Cache key generation with TTL suffix
- TTL checking for stale cache entries

#### 5. Component Tests

##### RepoRow Component (`RepoRow.test.tsx`)
**Coverage**: 74.5% | **Tests**: 1
- Renders repository name and metadata correctly

##### RepoListHeader Component (`RepoListHeader.test.tsx`)
**Coverage**: 100% | **Tests**: 8
- Personal account context display
- Organization context display (with/without name)
- Sort indicator display (field and direction)
- Fork tracking status display
- Filter display when not searching
- Search mode display
- All sort keys and directions

##### FilterInput Component (`FilterInput.test.tsx`)
**Coverage**: 100% | **Tests**: 6
- Filter label rendering
- Current filter value display
- Placeholder text when empty
- onChange callback invocation
- onSubmit callback invocation
- Works without optional debug prop

##### SlowSpinner Component (`SlowSpinner.test.tsx`)
**Coverage**: 100% | **Tests**: 5
- Initial spinner frame rendering
- Frame cycling over time
- Looping back to first frame
- 500ms update interval
- Cleanup on unmount

##### DeleteModal Component (`DeleteModal.test.tsx`)
**Coverage**: Partial | **Tests**: 4
- Verification code generation logic
- Code validation
- Error states

##### ArchiveModal Component (`ArchiveModal.test.tsx`)
**Coverage**: 64.42% | **Tests**: 6
- Archive confirmation for non-archived repos
- Unarchive confirmation for archived repos
- Button display
- Cancel action on Escape key
- Cancel action on 'C' key
- Null repository handling

##### LogoutModal Component (`LogoutModal.test.tsx`)
**Coverage**: 66.66% | **Tests**: 6
- Logout confirmation message
- Button display
- Keyboard shortcuts help text
- Cancel on Escape key
- Cancel on 'C' key
- Default focus state

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

### High Priority Tests to Implement

#### 1. Main Component Tests
- **RepoList.tsx** - Main component state management and logic
  - Pagination and infinite scroll
  - Sorting functionality
  - Filtering (client-side and server-side)
  - Rate limit handling
  - Error states
  
- **App.tsx** - Application initialization and routing
  - Token bootstrap flow
  - Initial data loading
  - Error boundary behavior

- **OrgSwitcher.tsx** - Organization switching
  - Organization list display
  - Context switching
  - Persistence of selected org

#### 2. Additional Modal Tests
- **InfoModal.tsx** - Repository information display
- **SyncModal.tsx** - Fork synchronization flow
- **DeleteModal.tsx** - Expand to test full deletion flow

#### 3. GitHub API Functions
Expand `github.test.ts` to cover:
- `fetchViewerReposPage()` with various parameters
- Organization repository queries
- Search functionality
- Rate limit information parsing
- Error handling for API failures

#### 4. Integration Tests
- **Modal Keyboard Navigation**
  - Arrow key navigation between buttons
  - Enter key submission
  - Escape key cancellation
  
- **Search Flow**
  - Triggering server-side search (3+ characters)
  - Debouncing behavior
  - Result display and navigation
  
- **Repository Actions**
  - Archive/unarchive flow
  - Delete confirmation flow
  - Fork sync flow

#### 5. State Management Tests
- Reducer logic in RepoList
- Action dispatching
- State updates and side effects

#### 6. Cache Management Tests
- Apollo cache persistence
- Cache invalidation
- Stale-while-revalidate behavior

### Testing Improvements

#### 1. Test Organization
- Group related tests into describe blocks
- Add more descriptive test names
- Create shared test utilities and fixtures

#### 2. Mock Data Management
- Create centralized mock data factories
- Standardize mock repository objects
- Create reusable GraphQL response mocks

#### 3. Coverage Goals
- Aim for 80%+ coverage on critical paths
- 100% coverage on utility functions
- 70%+ coverage on UI components
- Focus on business logic over UI details

#### 4. Performance Testing
- Test virtualization with large datasets
- Memory leak detection
- Render performance metrics

#### 5. Accessibility Testing
- Keyboard navigation
- Screen reader compatibility
- Focus management

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

## Best Practices

1. **Write tests alongside new features** - Don't let test debt accumulate
2. **Test behavior, not implementation** - Focus on what the component does
3. **Use descriptive test names** - Should read like documentation
4. **Keep tests isolated** - Each test should be independent
5. **Mock external dependencies** - Don't make real API calls
6. **Test edge cases** - Empty states, errors, loading states
7. **Maintain test fixtures** - Keep mock data organized and reusable

## Continuous Integration

Consider adding GitHub Actions workflow for automated testing:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3  # Optional: Upload coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
- [Testing React Hooks](https://react-hooks-testing-library.com/)
- [GraphQL Testing Best Practices](https://www.apollographql.com/docs/react/development-testing/testing/)

---

*Last Updated: December 2024*
*Total Tests: 82 | Test Files: 11 | Coverage: 7.62% overall (100% for tested utilities)*