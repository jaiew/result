# @jaiew/result

A zero-dependency, type-safe implementation of the **Result Pattern** for TypeScript. It provides an elegant, explicit alternative to throwing exceptions, allowing you to narrow and handle success and error states gracefully.

Fully optimized for modern environments, compiled as a hybrid module supporting both **ES Modules (ESM)** and **CommonJS (CJS)**.

---

## Features

* **Type-Safe Error Handling:** Leverage TypeScript type guards to narrow success or error payloads natively.


* **Functional Composition:** Seamlessly chain complex execution chains using `.map()`, `.mapError()`, and `.flatMap()`.


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

| Method                   | Description                                                                                |
|--------------------------|--------------------------------------------------------------------------------------------|
| **`isSuccess()`**        | Returns `true` if the operation succeeded, refining the type instance safely.              |
| **`isError()`**          | Returns `true` if the operation failed, refining the type instance safely.                 |
| **`map(fn)`**            | Transforms the successful inner value. Ignored if the result is an error.                  |
| **`mapError(fn)`**       | Transforms the error payload. Ignored if the result is a success.                          |
| **`flatMap(fn)`**        | Chains another operations that returns a `Result`, avoiding nested tracking layouts.       |
| **`match(handlers)`**    | Pattern matches simultaneously on success and error workflows.                             |
| **`unwrap()`**           | Extracts the success payload or throws a descriptive runtime exception if an error occurs. |
| **`unwrapOr(fallback)`** | Extracts the success value or returns a provided fallback default.                         |
| **`unwrapOrElse(fn)`**   | Extracts the success value or computes a fallback dynamically from the error metadata.     |

---

### Namespace & Utility Methods (`Result`)

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