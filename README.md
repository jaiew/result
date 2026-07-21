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
import { Result, createSuccess, createError, type SuccessOrError } from '@jaiew/result';

type User = { id: number; name: string };
type FetchError = { errorCode: 'NetworkError' | 'NotFound' };

async function fetchUser(id: number): Promise<SuccessOrError<User, FetchError>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return createError({ errorCode: 'NotFound' });
    return createSuccess(await res.json());
  } catch {
    return createError({ errorCode: 'NetworkError' });
  }
}

const result = await fetchUser(1);

if (result.isSuccess()) {
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

#### `createSuccess(value)`

Wraps a generic payload inside a `SuccessResult` object.

```typescript
const success = createSuccess({ id: 1, name: 'John' }); // SuccessResult<{ id: number, name: string }>
```

#### `createError(error)`

Wraps an operational error payload inside an `ErrorResult` object.

```typescript
const error = createError({ errorCode: 'NotFound', message: 'User not found' }); // ErrorResult<{ errorCode: string, message: string }>
```

---

### Instance Methods

The union type `SuccessOrError<T, E>` provides the following instance pipeline behaviors:

| Method                           | Description                                                                                |
|----------------------------------|--------------------------------------------------------------------------------------------|
| **`isSuccess()`**                | Returns `true` if the operation succeeded, refining the type instance safely.              |
| **`isError()`**                  | Returns `true` if the operation failed, refining the type instance safely.                 |
| **`map(fn)`**                    | Transforms the successful inner value. Ignored if the result is an error.                  |
| **`mapAsync(fn)`**               | Transforms the success value using an asynchronous mapping function.                       |
| **`mapError(fn)`**               | Transforms the error payload. Ignored if the result is a success.                          |
| **`flatMap(fn)`**                | Chains another operation that returns a `SuccessResult`, avoiding nested tracking layouts. |
| **`flatMapAsync(fn)`**           | Chains an asynchronous operation that returns a SuccessResult.                             |
| **`inspect(fn)`**                | Executes a side-effect callback with the success value without modifying the Result.       |
| **`inspectError(fn)`**           | Executes a side-effect callback with the error value without modifying the Result.         |
| **`filter(predicate, errorFn)`** | Converts a SuccessResult into an ErrorResult if the predicate evaluates to false.          |           
| **`match(handlers)`**            | Pattern matches simultaneously on success and error workflows.                             |
| **`unwrap()`**                   | Extracts the success payload or throws a descriptive runtime exception if an error occurs. |
| **`unwrapOr(fallback)`**         | Extracts the success value or returns a provided fallback default.                         |
| **`unwrapOrElse(fn)`**           | Extracts the success value or computes a fallback dynamically from the error metadata.     |

---

### Advanced Instance Usage Examples

#### Side-Effect Inspection (`inspect` & `inspectError`)

Use `.inspect()` and `.inspectError()` to execute side-effects like logging or analytics without modifying the result or interrupting the method chain

```typescript
const result = createSuccess({ id: 42, name: 'Alice' })
  .inspect(user => console.log('Loaded user:', user.name))
  .inspectError(err => console.error('Failed to load user:', err))
  .map(user => user.id);
```

#### Predicate Filtering (`filter`)
Validate success values in-flight. If the predicate returns `false`, `.filter()` converts the result into an `ErrorResult` produced by your error factory:

```typescript
const ageResult = createSuccess(16);

const validAge = ageResult.filter(
    age => age >= 18,
    age => `User age (${age}) does not meet the minimum requirement of 18.`
);

console.log(validAge.isError()); // true
console.log(validAge.unwrapOrElse(err => err)); // "User age (16) does not meet the minimum requirement of 18."
```

#### Async Method Chaining (`mapAsync` & `flatMapAsync`)

Seamlessly pass asynchronous callbacks along pipelines without manually awaiting every stage or nesting promises:

```typescript
const userIdResult = createSuccess('user_101');

// Asynchronously transform a value
const avatarUrlResult = await userIdResult.mapAsync(async id => {
    return await fetchAvatarUrl(id);
});

// Asynchronously chain operations that return a Result
const userProfileResult = await userIdResult.flatMapAsync(async id => {
    return await fetchUserProfileResult(id); // Returns Promise<SuccessOrError<Profile, Error>>
});
```

### Namespace & Utility Methods (`SuccessOrError`)

#### `Result.gen(fn)`

Executes a generator function, allowing `yield*` on `SuccessOrError` instances to automatically unwrap success values or short-circuit execution on the first encountered ErrorResult.

```typescript
import { Result, createSuccess, createError } from '@jaiew/result';

function getUser(id: number) {
  return createSuccess({ id, name: 'Alex', roleId: 3 });
}

function getRole(roleId: number) {
  return createSuccess({ id: roleId, title: 'Admin' });
}

const fullProfileResult = Result.gen(function* () {
  const user = yield* getUser(1);
  const role = yield* getRole(user.roleId);

  return {
    ...user,
    roleTitle: role.title,
  };
});

if (fullProfileResult.isSuccess()) {
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

#### `Result.fromThrowable(fn, errorMapper?)`

Wraps synchronous function blocks that may risk throwing standard system exceptions.

```typescript
const result = Result.fromThrowable(
  () => JSON.parse(userInput),
  (e) => ({ errorCode: 'InvalidJSON' as const, message: String(e) })
);
```

#### `Result.fromAsyncThrowable`

Wraps an `async` function (or a function returning a `Promise`) that may throw/reject, returning a new function that produces a `Promise<SuccessOrError<T, E>>`.

```typescript
import { Result } from '@jaiew/result'

// 1. Define or wrap an async function that might throw
const safeFetchJson = Result.fromAsyncThrowable(
    async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
    },
    (err) => ({ type: 'NETWORK_ERROR' as const, details: String(err) })
)

// 2. Call the safe function without needing try/catch blocks
const result = await safeFetchJson('https://api.example.com/data')

if (result.isSuccess()) {
    console.log('Data:', result.value)
} else {
    console.error('Error:', result.error.type)
}
```

#### `Result.all([...results])`

Combines an array of results. Short-circuits instantly and outputs the **first error encountered** if any fail.

```typescript
const combined = Result.all([userResult, postsResult, settingsResult]);

if (combined.isSuccess()) {
  const [user, posts, settings] = combined.value; // Typed tuple unpacking
}
```

#### `Result.allSettled([...results])`

Never errors out. Returns a wrapper holding a structured array tracking all outcomes exactly as they resolved.

```typescript
const settled = Result.allSettled([createSuccess(1), createError('error A')]);
// settled.isSuccess() is always true, holding the raw underlying array inputs
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
  if (maybeUnknownPayload.isSuccess()) { /* ... */ }
}
```

---

## License

This library is open-source software licensed under the [MIT License](https://www.google.com/search?q=LICENSE).