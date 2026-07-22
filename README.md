# @jaiew/result 
[![CI](https://github.com/jaiew/result/actions/workflows/ci.yml/badge.svg)](https://github.com/jaiew/result/actions)
[![codecov](https://codecov.io/github/jaiew/result/graph/badge.svg?token=WKIEAM7IS2)](https://codecov.io/github/jaiew/result)
[![npm version](https://img.shields.io/npm/v/@jaiew/result.svg)](https://www.npmjs.com/package/@jaiew/result)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-blue?logo=dependabot&logoColor=white)](https://github.com/jaiew/result/blob/main/.github/dependabot.yml)
[![Security Scan (CodeQL)](https://github.com/jaiew/result/actions/workflows/codeql.yml/badge.svg)](https://github.com/jaiew/result/actions/workflows/codeql.yml)
[![CodeRabbit AI](https://img.shields.io/badge/CodeRabbit-Reviewed-ff570a?logo=coderabbit&logoColor=white)](https://coderabbit.ai)

A zero-dependency, type-safe implementation of the **Result Pattern** for TypeScript. It provides an elegant, explicit alternative to throwing exceptions, allowing you to narrow and handle success and error states gracefully.

Fully optimized for modern environments, compiled as a hybrid module supporting both **ES Modules (ESM)** and **CommonJS (CJS)**.

---

## Features

* **Type-Safe Error Handling:** Leverage TypeScript type guards to narrow success or error payloads natively.
* **Functional Composition:** Seamlessly chain complex execution flows using `.map()`, `.mapError()`, `.flatMap()`, `.mapAsync()`, and `.flatMapAsync()`.
* **Side-Effect Inspection:** Peek at values or errors along pipeline chains without mutating the underlying result using `.inspect()` and `.inspectError()`.
* **Predicate Validation:** Validate success states in-flight with `.filter()`.
* **Generator-Based Composition (`Result.gen`):** Avoid nested callback chains with `yield*` do-notation for clean, sequential workflows.
* **Collection Utilities:** Robust control flow management using `Result.all()`, `Result.allSettled()`, and `Result.partition()`.
* **Safety Wrappers:** Easily convert traditional `Promise` resolutions or throwing functions into clean `Result` flows.


---

## Installation

```bash
npm install @jaiew/result
```

---

## Basic Usage

```typescript
import { Result, ok, err, type Result } from '@jaiew/result';

type User = { id: number; name: string };
type FetchError = { errorCode: 'NetworkError' | 'NotFound' };

async function fetchUser(id: number): Promise<Result<User, FetchError>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return err({ errorCode: 'NotFound' });
    return ok(await res.json());
  } catch {
    return err({ errorCode: 'NetworkError' });
  }
}

const result = await fetchUser(1);

if (result.isOk()) {
  // TypeScript safely narrows type here to expose `value`
  console.log(`User found: ${result.value.name}`);
} else {
  // TypeScript safely narrows type here to expose `error`
  console.error(`Failed to retrieve user: ${result.error.errorCode}`);
}
```

---

## API Reference

### Primitives & Initialization

#### `ok(value)`

Wraps a generic payload inside a `OkResult` object.

```typescript
const success = ok({ id: 1, name: 'John' }); // OkResult<{ id: number, name: string }>
```

#### `err(error)`

Wraps an operational error payload inside an `ErrorResult` object.

```typescript
const error = err({ errorCode: 'NotFound', message: 'User not found' }); // ErrorResult<{ errorCode: string, message: string }>
```

---

### Instance Methods

The union type `Result<T, E>` provides the following instance pipeline behaviors:

| Method                           | Description                                                                                |
|----------------------------------|--------------------------------------------------------------------------------------------|
| **`isOk()`**                     | Returns `true` if the operation succeeded, refining the type instance safely.              |
| **`isErr()`**                    | Returns `true` if the operation failed, refining the type instance safely.                 |
| **`map(fn)`**                    | Transforms the successful inner value. Ignored if the result is an error.                  |
| **`mapAsync(fn)`**               | Transforms the success value using an asynchronous mapping function.                       |
| **`mapError(fn)`**               | Transforms the error payload. Ignored if the result is a success.                          |
| **`flatMap(fn)`**                | Chains another operation that returns a `OkResult`, avoiding nested tracking layouts. |
| **`flatMapAsync(fn)`**           | Chains an asynchronous operation that returns a OkResult.                             |
| **`inspect(fn)`**                | Executes a side-effect callback with the success value without modifying the Result.       |
| **`inspectError(fn)`**           | Executes a side-effect callback with the error value without modifying the Result.         |
| **`filter(predicate, errorFn)`** | Converts a OkResult into an ErrorResult if the predicate evaluates to false.          |           
| **`match(handlers)`**            | Pattern matches simultaneously on success and error workflows.                             |
| **`unwrap()`**                   | Extracts the success payload or throws a descriptive runtime exception if an error occurs. |
| **`unwrapOr(fallback)`**         | Extracts the success value or returns a provided fallback default.                         |
| **`unwrapOrElse(fn)`**           | Extracts the success value or computes a fallback dynamically from the error metadata.     |

---

### Advanced Instance Usage Examples

#### Side-Effect Inspection (`inspect` & `inspectError`)

Use `.inspect()` and `.inspectError()` to execute side-effects like logging or analytics without modifying the result or interrupting the method chain

```typescript
const result = ok({ id: 42, name: 'Alice' })
  .inspect(user => console.log('Loaded user:', user.name))
  .inspectError(err => console.error('Failed to load user:', err))
  .map(user => user.id);
```

#### Predicate Filtering (`filter`)
Validate success values in-flight. If the predicate returns `false`, `.filter()` converts the result into an `ErrorResult` produced by your error factory:

```typescript
const ageResult = ok(16);

const validAge = ageResult.filter(
    age => age >= 18,
    age => `User age (${age}) does not meet the minimum requirement of 18.`
);

console.log(validAge.isErr()); // true
console.log(validAge.unwrapOrElse(err => err)); // "User age (16) does not meet the minimum requirement of 18."
```

#### Async Method Chaining (`mapAsync` & `flatMapAsync`)

Seamlessly pass asynchronous callbacks along pipelines without manually awaiting every stage or nesting promises:

```typescript
const userIdResult = ok('user_101');

// Asynchronously transform a value
const avatarUrlResult = await userIdResult.mapAsync(async id => {
    return await fetchAvatarUrl(id);
});

// Asynchronously chain operations that return a Result
const userProfileResult = await userIdResult.flatMapAsync(async id => {
    return await fetchUserProfileResult(id); // Returns Promise<Result<Profile, Error>>
});
```

### Namespace & Utility Methods (`Result`)

#### `Result.gen(fn)`

Executes a generator function, allowing `yield*` on `Result` instances to automatically unwrap success values or short-circuit execution on the first encountered ErrorResult.

```typescript
import { Result, ok, err } from '@jaiew/result';

function getUser(id: number) {
  return ok({ id, name: 'Alex', roleId: 3 });
}

function getRole(roleId: number) {
  return ok({ id: roleId, title: 'Admin' });
}

const fullProfileResult = Result.gen(function* () {
  const user = yield* getUser(1);
  const role = yield* getRole(user.roleId);

  return {
    ...user,
    roleTitle: role.title,
  };
});

if (fullProfileResult.isOk()) {
  console.log('Profile:', fullProfileResult.unwrap());
}
```

#### `Result.fromPromise(promise, errorMapper?)`

Safely intercept an asynchronous task. Catches runtime failures and maps them cleanly to an error primitive.

```typescript
const result = await Result.fromPromise(
  fetch('/api/data').then(r => r.json()),
  (e) => ({ errorCode: 'FetchError' as const, cause: e })
);
```

#### `Result.try(fn, errorMapper?)`

A unified wrapper for executing code that may throw, handling both **synchronous** and **asynchronous** operations automatically.

```typescript
const result = Result.try(
  () => JSON.parse(userInput),
  (e) => ({ errorCode: 'InvalidJSON' as const, message: String(e) })
);
```

```typescript
import { Result } from '@jaiew/result'

// 1. Define or wrap an async function that might throw
const safeFetchJson = Result.try(
    async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
    },
    (err) => ({ type: 'NETWORK_ERROR' as const, details: String(err) })
)

// 2. Call the safe function without needing try/catch blocks
const result = await safeFetchJson('https://api.example.com/data')

if (result.isOk()) {
    console.log('Data:', result.value)
} else {
    console.error('Error:', result.error.type)
}
```

#### `Result.all([...results])`

Combines an array of results. Short-circuits instantly and outputs the **first error encountered** if any fail.

```typescript
const combined = Result.all([userResult, postsResult, settingsResult]);

if (combined.isOk()) {
  const [user, posts, settings] = combined.value; // Typed tuple unpacking
}
```

#### `Result.allSettled([...results])`

Never errors out. Returns a wrapper holding a structured array tracking all outcomes exactly as they resolved.

```typescript
const settled = Result.allSettled([ok(1), err('error A')]);
// settled.isOk() is always true, holding the raw underlying array inputs
```

#### `Result.partition([...results])`

Splits an aggregate collection of outputs into an object containing distinct collections of successfully unwrapped values and underlying error objects.

```typescript
const { values: users, errors: failures } = Result.partition(userResults).value;

console.log(`Successfully mapped ${users.length} profiles. Faults: ${failures.length}.`);
```

#### `Result.isResult(value)`

Runtime type check to verify if an incoming arbitrary payload fits the structural validation interface of a library standard Result.

```typescript
if (Result.isResult(maybeUnknownPayload)) {
  if (maybeUnknownPayload.isOk()) { /* ... */ }
}
```

---

## License

This library is open-source software licensed under the [MIT License](https://www.google.com/search?q=LICENSE).