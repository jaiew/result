/**
 * A type-safe Result pattern implementation for handling success and error states.
 *
 * @example Basic usage
 * ```typescript
 * import { Result, ok, err, type Result } from '@jaiew/result';
 *
 * type User = { id: number; name: string };
 * type FetchError = { errorCode: 'NetworkError' | 'NotFound' };
 *
 * async function fetchUser(id: number): Promise<Result<User, FetchError>> {
 *   try {
 *     const res = await fetch(`/api/users/${id}`);
 *     if (!res.ok) return err({ errorCode: 'NotFound' });
 *     return ok(await res.json());
 *   } catch {
 *     return err({ errorCode: 'NetworkError' });
 *   }
 * }
 *
 * const result = await fetchUser(1);
 * if (result.isOk()) {
 *   console.log(result.value.name);
 * } else {
 *   console.error(result.error.errorCode);
 * }
 * ```
 */

/**
 * Represents a successful result containing a value of type T.
 *
 * @template T - The type of the success value
 *
 * @example
 * ```typescript
 * const success = ok({ id: 1, name: 'John' });
 * console.log(success.isOk()); // true
 * console.log(success.value.name); // 'John'
 * ```
 */
export class OkResult<T> {
  readonly kind = 'success' as const
  readonly value: T

  constructor(value: T) {
    this.value = value
  }

  /**
   * Type guard that returns true if this is a success result.
   * Enables TypeScript to narrow the type in conditional blocks.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isOk()) {
   *   // TypeScript knows result.value exists here
   *   console.log(result.value);
   * }
   * ```
   */
  isOk(): this is OkResult<T> {
    return true
  }

  /**
   * Type guard that returns true if this is an error result.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isErr()) {
   *   // TypeScript knows result.error exists here
   *   console.log(result.error);
   * }
   * ```
   */
  isErr(): this is never {
    return false
  }

  /**
   * Transforms the success value using the provided function.
   * Has no effect on error results.
   *
   * @template U - The type of the transformed value
   * @param fn - Function to transform the success value
   * @returns A new Result with the transformed value
   *
   * @example
   * ```typescript
   * const result = ok({ id: 1, name: 'John' });
   * const nameResult = result.map(user => user.name);
   * // nameResult.value === 'John'
   * ```
   */
  map<U>(fn: (value: T) => U): OkResult<U> {
    return new OkResult(fn(this.value))
  }

  /**
   * Transforms the error using the provided function.
   * Has no effect on success results (returns this unchanged).
   *
   * @template F - The type of the transformed error
   * @param _fn - Function to transform the error (not called for success)
   * @returns This success result unchanged
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * const mapped = result.mapError(e => ({ ...e, timestamp: Date.now() }));
   * // mapped.value === 42 (unchanged)
   * ```
   */
  mapError<F>(_fn: (error: never) => F): OkResult<T> {
    return this
  }

  /**
   * Chains another Result-returning operation.
   * Useful for composing multiple operations that may fail.
   *
   * @template U - The success type of the chained operation
   * @template F - The error type of the chained operation
   * @param fn - Function that returns another Result
   * @returns The Result from the chained function
   *
   * @example
   * ```typescript
   * const result = parseUserId(input)
   *   .flatMap(id => fetchUser(id))
   *   .flatMap(user => validatePermissions(user));
   * ```
   */
  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
    return fn(this.value)
  }

  /**
   * Transforms the contained success value with an asynchronous function.
   *
   * @template U - The return type of the async transformation function
   * @param fn - Async function to apply to the success value
   * @returns A promise resolving to a new `OkResult` with the mapped value
   *
   * @example
   * ```typescript
   * const result = ok(2);
   * const asyncResult = await result.mapAsync(async val => val * 2); // OkResult(4)
   * ```
   */
  async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<OkResult<U>> {
    const newValue = await fn(this.value)
    return ok(newValue)
  }

  /**
   * Chains an asynchronous operation that returns a `Result`.
   *
   * @template U - The success type of the returned Result promise
   * @template E2 - The error type of the returned Result promise
   * @param fn - Async function returning a `Result`
   * @returns A promise resolving to the resulting `Result`
   *
   * @example
   * ```typescript
   * const result = ok("user_123");
   * const user = await result.flatMapAsync(async id => fetchUserAsync(id));
   * ```
   */
  async flatMapAsync<U, E2>(fn: (value: T) => Promise<Result<U, E2>>): Promise<Result<U, E2>> {
    return await fn(this.value)
  }

  /**
   * Evaluates a predicate against the success value. Converts to an `ErrorResult` if the predicate returns false.
   *
   * @template E2 - The type of the error produced if validation fails
   * @param predicate - Function returning true to keep success, or false to convert to error
   * @param errorFactory - Function producing the error value if predicate returns false
   * @returns The current `OkResult` if predicate is true, or a new `ErrorResult` if false
   *
   * @example
   * ```typescript
   * const result = ok(15);
   * const valid = result.filter(
   *   val => val >= 18,
   *   val => `Age ${val} is under 18`
   * ); // ErrorResult("Age 15 is under 18")
   * ```
   */
  filter<E2>(predicate: (value: T) => boolean, errorFactory: (value: T) => E2): Result<T, E2> {
    if (!predicate(this.value)) {
      return err(errorFactory(this.value))
    }
    return this
  }

  /**
   * Pattern matches on the result, calling the appropriate function.
   *
   * @template U - The return type of both match functions
   * @param handlers - Object with onSuccess and onError handlers
   * @returns The result of the matched handler
   *
   * @example
   * ```typescript
   * const message = result.match({
   *   onSuccess: (user) => `Welcome, ${user.name}!`,
   *   onError: (error) => `Error: ${error.errorCode}`,
   * });
   * ```
   */
  match<U>(handlers: { onSuccess: (value: T) => U; onError: (error: never) => U }): U {
    return handlers.onSuccess(this.value)
  }

  /**
   * Extracts the success value or throws an error.
   * Use with caution - prefer `unwrapOr` or `match` for safer handling.
   *
   * @returns The success value
   * @throws Never throws for OkResult
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * const value = result.unwrap(); // 42
   * ```
   */
  unwrap(): T {
    return this.value
  }

  /**
   * Extracts the success value or returns a default value.
   *
   * @template U - The type of the default value
   * @param _defaultValue - Value to return if this is an error (not used for success)
   * @returns The success value
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * const value = result.unwrapOr(0); // 42
   * ```
   */
  unwrapOr<U>(_defaultValue: U): T {
    return this.value
  }

  /**
   * Extracts the success value or computes a default from the error.
   *
   * @template U - The type of the computed default value
   * @param _fn - Function to compute default from error (not called for success)
   * @returns The success value
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * const value = result.unwrapOrElse(error => {
   *   console.error(error);
   *   return 0;
   * }); // 42
   * ```
   */
  unwrapOrElse<U>(_fn: (error: never) => U): T {
    return this.value
  }

  /**
   * Executes a side-effect callback with the success value without modifying the result.
   *
   * @param fn - Function to execute with the success value
   * @returns The current `OkResult` instance
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * result.inspect(value => console.log(value)); // logs 42
   * ```
   */
  inspect(fn: (value: T) => void): this {
    fn(this.value)
    return this
  }

  /**
   * No-op on `OkResult`. Does not execute the callback.
   *
   * @template E - The potential error type
   * @param _fn - Function to execute with the error (not called for success)
   * @returns The current `OkResult` instance
   *
   * @example
   * ```typescript
   * const result = ok(42);
   * result.inspectError(err => console.error(err)); // does nothing
   * ```
   */
  inspectError<E = never>(_fn: (error: E) => void): this {
    return this
  }

  /**
   * Enables generator integration for `Result.gen`. Yields nothing and returns the success value.
   *
   * @template E - The potential error type
   * @returns The contained success value directly
   *
   * @example
   * ```typescript
   * const result = createSuccess(42);
   * const val = yield* result; // 42
   * ```
   */
  // eslint-disable-next-line require-yield
  *[Symbol.iterator](): Generator<never, T, unknown> {
    return this.value
  }
}

/**
 * Represents an error result containing an error of type E.
 *
 * @template E - The type of the error value
 *
 * @example
 * ```typescript
 * const error = err({ errorCode: 'NotFound', message: 'User not found' });
 * console.log(error.error.errorCode); // 'NotFound'
 * console.log(error.isErr()); // true
 * ```
 */
export class ErrorResult<E> {
  readonly kind = 'error' as const
  readonly error: E

  constructor(error: E) {
    this.error = error
  }

  /**
   * Type guard that returns true if this is a success result.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isOk()) {
   *   console.log(result.value);
   * }
   * ```
   */
  isOk(): this is never {
    return false
  }

  /**
   * Type guard that returns true if this is an error result.
   * Enables TypeScript to narrow the type in conditional blocks.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isErr()) {
   *   // TypeScript knows result.error exists here
   *   console.log(result.error.errorCode);
   * }
   * ```
   */
  isErr(): this is ErrorResult<E> {
    return true
  }

  /**
   * Transforms the success value using the provided function.
   * Has no effect on error results (returns this unchanged).
   *
   * @template U - The type of the transformed value
   * @param _fn - Function to transform the value (not called for errors)
   * @returns This error result unchanged
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'NotFound' });
   * const mapped = result.map(user => user.name);
   * // mapped is still an error with the same error value
   * ```
   */
  map<U>(_fn: (value: never) => U): ErrorResult<E> {
    return this
  }

  /**
   * Transforms the error using the provided function.
   *
   * @template F - The type of the transformed error
   * @param fn - Function to transform the error
   * @returns A new ErrorResult with the transformed error
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'NotFound' });
   * const mapped = result.mapError(e => ({
   *   ...e,
   *   timestamp: Date.now(),
   *   severity: 'warning'
   * }));
   * ```
   */
  mapError<F>(fn: (error: E) => F): ErrorResult<F> {
    return new ErrorResult(fn(this.error))
  }

  /**
   * Chains another Result-returning operation.
   * Has no effect on error results (returns this unchanged).
   *
   * @template U - The success type of the chained operation
   * @template F - The error type of the chained operation
   * @param _fn - Function that returns another Result (not called for errors)
   * @returns This error result unchanged
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'InvalidInput' });
   * const chained = result.flatMap(value => fetchData(value));
   * // chained is still the original error
   * ```
   */
  flatMap<U, F>(_fn: (value: never) => Result<U, F>): ErrorResult<E> {
    return this
  }

  /**
   * No-op on `ErrorResult`. Does not execute the async mapping function.
   *
   * @template U - The potential transformed value type
   * @param _fn - Async function (not called for error)
   * @returns A promise resolving to the current `ErrorResult` instance
   *
   * @example
   * ```typescript
   * const result = err("network error");
   * const mapped = await result.mapAsync(async val => val * 2); // ErrorResult("network error")
   * ```
   */
  async mapAsync<U = never>(_fn: (value: never) => Promise<U>): Promise<ErrorResult<E>> {
    return this
  }

  /**
   * No-op on `ErrorResult`. Does not execute the async flatMap function.
   *
   * @template U - The potential success type of the return Result
   * @template E2 - The potential error type of the return Result
   * @param _fn - Async flatMap function (not called for error)
   * @returns A promise resolving to the current `ErrorResult` instance
   *
   * @example
   * ```typescript
   * const result = err("network error");
   * const flatMapped = await result.flatMapAsync(async id => fetchUserAsync(id)); // ErrorResult("network error")
   * ```
   */
  async flatMapAsync<U = never, E2 = never>(
    _fn: (value: never) => Promise<Result<U, E2>>
  ): Promise<ErrorResult<E>> {
    return this
  }

  /**
   * No-op on `ErrorResult`. Does not evaluate the predicate.
   *
   * @template T - The potential success type
   * @template E2 - The potential new error type
   * @param _predicate - Predicate function (not called for error)
   * @param _errorFactory - Error factory function (not called for error)
   * @returns The current `ErrorResult` instance
   *
   * @example
   * ```typescript
   * const result = err("initial error");
   * const filtered = result.filter(
   *   val => val > 0,
   *   () => "invalid"
   * ); // ErrorResult("initial error")
   * ```
   */
  filter<T = never, E2 = never>(
    _predicate: (value: T) => boolean,
    _errorFactory: (value: T) => E2
  ): ErrorResult<E> {
    return this
  }

  /**
   * Pattern matches on the result, calling the appropriate function.
   *
   * @template U - The return type of both match functions
   * @param handlers - Object with onSuccess and onError handlers
   * @returns The result of the onError handler
   *
   * @example
   * ```typescript
   * const message = result.match({
   *   onSuccess: (user) => `Welcome, ${user.name}!`,
   *   onError: (error) => `Error: ${error.errorCode}`,
   * });
   * ```
   */
  match<U>(handlers: { onSuccess: (value: never) => U; onError: (error: E) => U }): U {
    return handlers.onError(this.error)
  }

  /**
   * Extracts the success value or throws an error.
   * Always throws for ErrorResult.
   *
   * @returns Never returns - always throws
   * @throws Error with the error value stringified
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'NotFound' });
   * result.unwrap(); // Throws: "Called unwrap() on ErrorResult: {\"errorCode\":\"NotFound\"}"
   * ```
   */
  unwrap(): never {
    throw new Error(`Called unwrap() on ErrorResult: ${JSON.stringify(this.error)}`)
  }

  /**
   * Returns the default value since this is an error result.
   *
   * @template U - The type of the default value
   * @param defaultValue - Value to return since this is an error
   * @returns The default value
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'NotFound' });
   * const value = result.unwrapOr({ id: 0, name: 'Guest' });
   * // value === { id: 0, name: 'Guest' }
   * ```
   */
  unwrapOr<U>(defaultValue: U): U {
    return defaultValue
  }

  /**
   * Computes a fallback value from the error.
   *
   * @template U - The type of the computed default value
   * @param fn - Function to compute fallback from the error
   * @returns The computed fallback value
   *
   * @example
   * ```typescript
   * const result = err({ errorCode: 'NotFound', userId: 123 });
   * const value = result.unwrapOrElse(error => {
   *   logError(error);
   *   return { id: error.userId, name: 'Unknown' };
   * });
   * ```
   */
  unwrapOrElse<U>(fn: (error: E) => U): U {
    return fn(this.error)
  }

  /**
   * No-op on `ErrorResult`. Does not execute the callback.
   *
   * @template T - The potential success type
   * @param _fn - Function to execute with the value (not called for error)
   * @returns The current `ErrorResult` instance
   *
   * @example
   * ```typescript
   * const result = err("failed");
   * result.inspect(value => console.log(value)); // does nothing
   * ```
   */
  inspect<T = never>(_fn: (value: T) => void): this {
    return this
  }

  /**
   * Executes a side-effect callback with the error without modifying the result.
   *
   * @param fn - Function to execute with the error value
   * @returns The current `ErrorResult` instance
   *
   * @example
   * ```typescript
   * const result = err("failed");
   * result.inspectError(err => console.error(err)); // logs "failed"
   * ```
   */
  inspectError(fn: (error: E) => void): this {
    fn(this.error)
    return this
  }

  /**
   * Enables generator integration for `Result.gen`. Yields the error result to short-circuit execution.
   *
   * @template T - The potential success type
   * @returns `never` (short-circuits generator execution via `yield`)
   *
   * @example
   * ```typescript
   * const result = createError("failed");
   * const val = yield* result; // short-circuits execution in Result.gen
   * ```
   */
  *[Symbol.iterator](): Generator<ErrorResult<E>, never, unknown> {
    yield this
    /* c8 ignore next */
    throw new Error('Unreachable')
  }
}

/**
 * Union type representing either a success or error result.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 *
 * @example
 * ```typescript
 * type ApiResult = Result<User, { errorCode: 'NotFound' | 'Forbidden' }>;
 *
 * async function getUser(id: number): Promise<ApiResult> {
 *   // ...
 * }
 * ```
 */
export type Result<T, E> = OkResult<T> | ErrorResult<E>

/**
 * Creates a success result containing the provided value.
 *
 * @template T - The type of the success value
 * @param value - The success value
 * @returns A OkResult containing the value
 *
 * @example
 * ```typescript
 * const result = ok({ id: 1, name: 'John' });
 * ```
 */
export function ok<T>(value: T): OkResult<T> {
  return new OkResult(value)
}

/**
 * Creates an error result containing the provided error.
 *
 * @template E - The type of the error value
 * @param error - The error value
 * @returns An ErrorResult containing the error
 *
 * @example
 * ```typescript
 * const result = err({ errorCode: 'NotFound', message: 'User not found' });
 * ```
 */
export function err<E>(error: E): ErrorResult<E> {
  return new ErrorResult(error)
}

/**
 * Executes a function that may throw or reject, catching any caught error
 * and wrapping the result in a `Result`.
 *
 * Automatically handles both synchronous and asynchronous functions based on whether
 * the returned value is a Promise / Thenable.
 *
 * @template T The success value type.
 * @template E The error value type (defaults to `unknown`).
 *
 * @param fn A synchronous or asynchronous function to execute safely.
 * @param errorMapper Optional mapping function to transform caught errors into type `E`.
 * @returns A `Result<T, E>` if `fn` is synchronous, or a `Promise<Result<T, E>>` if `fn` is asynchronous.
 *
 * @example Synchronous execution
 * ```ts
 * const parsed = tryFn(
 *   () => JSON.parse(input),
 *   (err) => 'INVALID_JSON'
 * )
 * // Returns: Result<any, string>
 * ```
 *
 * @example Asynchronous execution
 * ```ts
 * const res = await tryFn(
 *   async () => fetchUser(id),
 *   (err) => 'FETCH_ERROR'
 * )
 * // Returns: Promise<Result<User, string>>
 * ```
 */
export function tryFn<T, E = unknown>(
  fn: () => T extends Promise<unknown> ? never : T,
  errorMapper?: (error: unknown) => E
): Result<T, E>
export function tryFn<T, E = unknown>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>>
export function tryFn<T, E = unknown>(
  fn: () => T | Promise<T>,
  errorMapper?: (error: unknown) => E
): Result<T, E> | Promise<Result<T, E>> {
  try {
    const result = fn()

    // Check if the return value is a Promise / Thenable
    if (
      result !== null &&
      (typeof result === 'object' || typeof result === 'function') &&
      typeof (result as Promise<T>).then === 'function'
    ) {
      return (result as Promise<T>)
        .then((value) => ok(value))
        .catch((e) => err(errorMapper ? errorMapper(e) : e)) as Promise<Result<T, E>>
    }

    return ok(result as T)
  } catch (e) {
    return err(errorMapper ? errorMapper(e) : (e as E))
  }
}

/**
 * Utility object for working with Results.
 *
 * @example
 * ```typescript
 * // Wrap a promise
 * const result = await Result.fromPromise(
 *   fetch('/api/user'),
 *   (e) => ({ errorCode: 'NetworkError' as const, message: String(e) })
 * );
 *
 * // Wrap a throwing function
 * const parsed = Result.fromThrowable(
 *   () => JSON.parse(input),
 *   () => ({ errorCode: 'ParseError' as const })
 * );
 *
 * // Combine multiple results
 * const [user, posts] = Result.all([userResult, postsResult]).unwrapOr([null, []]);
 * ```
 */
export const Result = {
  /**
   * Creates a success result.
   */
  ok,

  /**
   * Creates an error result.
   */
  err,

  /**
   * Wraps a Promise into a Result, catching any thrown errors.
   *
   * @template T - The resolved type of the promise
   * @template E - The error type (defaults to unknown)
   * @param promise - The promise to wrap
   * @param errorMapper - Optional function to transform caught errors
   * @returns A Promise resolving to a Result
   *
   * @example
   * ```typescript
   * const result = await Result.fromPromise(
   *   fetch('/api/data').then(r => r.json()),
   *   (e) => ({ errorCode: 'FetchError' as const, cause: e })
   * );
   *
   * if (result.isOk()) {
   *   console.log(result.value);
   * }
   * ```
   */
  async fromPromise<T, E = unknown>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const value = await promise
      return ok(value)
    } catch (e) {
      return err(errorMapper ? errorMapper(e) : e) as Result<T, E>
    }
  },

  /**
   * Unified wrapper for executing code that may throw or reject, automatically
   * detecting synchronous vs. asynchronous execution. Alias for {@link tryFn}.
   *
   * @see {@link tryFn} for direct standalone usage.
   *
   * @example
   * const syncRes = Result.try(() => JSON.parse('{"a": 1}'))
   * const asyncRes = await Result.try(async () => fetch('/api'))
   */
  try: tryFn,

  /**
   * Combines multiple Results into a single Result containing an array of values.
   * Fails fast on the first error encountered.
   *
   * @template T - Tuple type of the results
   * @param results - Array of Results to combine
   * @returns A Result containing all success values or the first error
   *
   * @example
   * ```typescript
   * const userResult = await fetchUser(1);
   * const postsResult = await fetchPosts(1);
   * const settingsResult = await fetchSettings(1);
   *
   * const combined = Result.all([userResult, postsResult, settingsResult]);
   *
   * if (combined.isOk()) {
   *   const [user, posts, settings] = combined.value;
   *   // All three succeeded
   * } else {
   *   // At least one failed
   *   console.error(combined.error);
   * }
   * ```
   */
  all<T extends readonly Result<unknown, unknown>[]>(
    results: T
  ): Result<
    {
      -readonly [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never
    },
    T[number] extends Result<unknown, infer E> ? E : never
  > {
    const values: unknown[] = []
    for (const result of results) {
      if (result.isErr()) {
        return result as ErrorResult<T[number] extends Result<unknown, infer E> ? E : never>
      }
      values.push(result.value)
    }
    return ok(values) as OkResult<{
      -readonly [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never
    }>
  },

  /**
   * Combines multiple Results like Promise.allSettled - never rejects.
   * Returns an array of settled results where each is either a success or error.
   *
   * This matches the behavior of Promise.allSettled where the outer promise
   * never rejects; instead you get an array of PromiseSettledResult objects.
   *
   * @template T - Tuple type of the results
   * @param results - Array of Results to settle
   * @returns Always returns Success containing an array of all Results (success or error)
   *
   * @example
   * ```typescript
   * // Fetch multiple users - always succeeds with array of Results
   * const userResults = await Promise.all([
   *   fetchUser(1),
   *   fetchUser(2),
   *   fetchUser(3),
   * ]);
   *
   * const settled = Result.allSettled(userResults);
   * // settled.isOk() is always true
   * const results = settled.value; // Array of Result<User, FetchError>
   *
   * results.forEach((result, index) => {
   *   if (result.isOk()) {
   *     console.log(`User ${index}:`, result.value);
   *   } else {
   *     console.log(`User ${index} failed:`, result.error);
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Compare with all() behavior
   * const results = [
   *   ok(1),
   *   err('error A'),
   *   err('error B'),
   * ];
   *
   * Result.all(results);        // ErrorResult - short-circuits on first error
   * Result.allSettled(results); // OkResult with 3-item array (all Results)
   * ```
   */
  allSettled<T extends readonly Result<unknown, unknown>[]>(results: T): OkResult<T> {
    return ok(results)
  },

  /**
   * Partitions results into successes and errors without short-circuiting.
   * Always returns a Success containing both arrays.
   *
   * Use this when you want to process both successful and failed results,
   * regardless of how many of each there are.
   *
   * @template T - The success value type of each result
   * @template E - The error type of each result
   * @param results - Array of Results to partition
   * @returns A Success containing { values, errors } arrays
   *
   * @example
   * ```typescript
   * // Process all results, successful or not
   * const results = await Promise.all([
   *   fetchUser(1),
   *   fetchUser(2),
   *   fetchUser(3),
   * ]);
   *
   * const { values: users, errors: failures } = Result.partition(results).value;
   *
   * console.log(`Got ${users.length} users and ${failures.length} failures`);
   * users.forEach(user => addToCache(user));
   * failures.forEach(error => logError(error));
   * ```
   *
   * @example
   * ```typescript
   * // Distinguish successes from failures without checking length
   * const userResults = [
   *   ok({ id: 1, name: 'Alice' }),
   *   err({ errorCode: 'NotFound' }),
   *   ok({ id: 3, name: 'Charlie' }),
   * ];
   *
   * const partitioned = Result.partition(userResults);
   * const { values: users, errors } = partitioned.value;
   *
   * // users = [{ id: 1, name: 'Alice' }, { id: 3, name: 'Charlie' }]
   * // errors = [{ errorCode: 'NotFound' }]
   * ```
   */
  partition<T extends readonly Result<unknown, unknown>[]>(
    results: T
  ): OkResult<{
    values: {
      -readonly [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never
    }
    errors: Array<T[number] extends Result<unknown, infer E> ? E : never>
  }> {
    const values: unknown[] = []
    const errors: unknown[] = []

    for (const result of results) {
      if (result.isOk()) {
        values.push(result.value)
      } else {
        errors.push(result.error)
      }
    }

    return ok({
      values,
      errors,
    }) as OkResult<{
      values: {
        -readonly [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never
      }
      errors: Array<T[number] extends Result<unknown, infer E> ? E : never>
    }>
  },

  /**
   * Checks if a value is a Result (either OkResult or ErrorResult).
   *
   * Type  parameters are not validated at runtime — use them only when
   * the shape of T and E is known at the call site.
   *
   * @template T - The expected success value type (defaults to unknown)
   * @template E - The expected error type (defaults to unknown)
   *
   * @param value - The value to check
   * @returns True if the value is a Result
   *
   * @example
   * ```typescript
   * const maybeResult = someFunction();
   * if (Result.isResult(maybeResult)) {
   *   // TypeScript knows this is a Result
   *   if (maybeResult.isOk()) {
   *     console.log(maybeResult.value);
   *   }
   * }
   * ```
   */
  isResult<T = unknown, E = unknown>(value: unknown): value is Result<T, E> {
    return value instanceof OkResult || value instanceof ErrorResult
  },

  /**
   * Executes a generator function whose body delegates to `Result` values with `yield*`.
   * Each yielded success value is unwrapped and fed back into the generator, and the first error
   * result is returned immediately without continuing execution.
   *
   * @template R - The final return type produced by the generator.
   * @template T - The success value type yielded and sent back into the generator.
   * @template E - The error type carried by `ErrorResult`.
   * @param fn - A generator function that delegates to `Result` values using `yield*`.
   * @returns A `OkResult<R>` when the generator completes successfully, or the first `ErrorResult<E>`.
   *
   * @example
   * ```ts
   * const combined = Result.gen(function* () {
   *   const user = yield* fetchUser(1)
   *   const config = yield* fetchConfig(user.role)
   *   return { user, config }
   * })
   * ```
   */
  gen<T, E = never>(fn: () => Generator<Result<T, E>, T, T>): Result<T, E> {
    const iterator = fn()
    let state = iterator.next()

    while (!state.done) {
      const result = state.value
      if (result.isErr()) {
        return result
      }
      state = iterator.next(result.unwrap())
    }

    return ok(state.value)
  },
} as const
