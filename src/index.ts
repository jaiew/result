/**
 * A type-safe Result pattern implementation for handling success and error states.
 *
 * @example Basic usage
 * ```typescript
 * import { Result, createSuccess, createError, type SuccessOrError } from '@jaiew/result';
 *
 * type User = { id: number; name: string };
 * type FetchError = { errorCode: 'NetworkError' | 'NotFound' };
 *
 * async function fetchUser(id: number): Promise<SuccessOrError<User, FetchError>> {
 *   try {
 *     const res = await fetch(`/api/users/${id}`);
 *     if (!res.ok) return createError({ errorCode: 'NotFound' });
 *     return createSuccess(await res.json());
 *   } catch {
 *     return createError({ errorCode: 'NetworkError' });
 *   }
 * }
 *
 * const result = await fetchUser(1);
 * if (result.isSuccess()) {
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
 * const success = createSuccess({ id: 1, name: 'John' });
 * console.log(success.isSuccess()); // true
 * console.log(success.value.name); // 'John'
 * ```
 */
export class SuccessResult<T> {
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
   * if (result.isSuccess()) {
   *   // TypeScript knows result.value exists here
   *   console.log(result.value);
   * }
   * ```
   */
  isSuccess(): this is SuccessResult<T> {
    return true
  }

  /**
   * Type guard that returns true if this is an error result.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isError()) {
   *   // TypeScript knows result.error exists here
   *   console.log(result.error);
   * }
   * ```
   */
  isError(): this is never {
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
   * const result = createSuccess({ id: 1, name: 'John' });
   * const nameResult = result.map(user => user.name);
   * // nameResult.value === 'John'
   * ```
   */
  map<U>(fn: (value: T) => U): SuccessResult<U> {
    return new SuccessResult(fn(this.value))
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
   * const result = createSuccess(42);
   * const mapped = result.mapError(e => ({ ...e, timestamp: Date.now() }));
   * // mapped.value === 42 (unchanged)
   * ```
   */
  mapError<F>(_fn: (error: never) => F): SuccessResult<T> {
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
  flatMap<U, F>(fn: (value: T) => SuccessOrError<U, F>): SuccessOrError<U, F> {
    return fn(this.value)
  }

  /**
   * Transforms the contained success value with an asynchronous function.
   *
   * @template U - The return type of the async transformation function
   * @param fn - Async function to apply to the success value
   * @returns A promise resolving to a new `SuccessResult` with the mapped value
   *
   * @example
   * ```typescript
   * const result = createSuccess(2);
   * const asyncResult = await result.mapAsync(async val => val * 2); // SuccessResult(4)
   * ```
   */
  async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<SuccessResult<U>> {
    const newValue = await fn(this.value)
    return createSuccess(newValue)
  }

  /**
   * Chains an asynchronous operation that returns a `Result`.
   *
   * @template U - The success type of the returned Result promise
   * @template E2 - The error type of the returned Result promise
   * @param fn - Async function returning a `SuccessOrError`
   * @returns A promise resolving to the resulting `SuccessOrError`
   *
   * @example
   * ```typescript
   * const result = createSuccess("user_123");
   * const user = await result.flatMapAsync(async id => fetchUserAsync(id));
   * ```
   */
  async flatMapAsync<U, E2>(
    fn: (value: T) => Promise<SuccessOrError<U, E2>>
  ): Promise<SuccessOrError<U, E2>> {
    return await fn(this.value)
  }

  /**
   * Evaluates a predicate against the success value. Converts to an `ErrorResult` if the predicate returns false.
   *
   * @template E2 - The type of the error produced if validation fails
   * @param predicate - Function returning true to keep success, or false to convert to error
   * @param errorFactory - Function producing the error value if predicate returns false
   * @returns The current `SuccessResult` if predicate is true, or a new `ErrorResult` if false
   *
   * @example
   * ```typescript
   * const result = createSuccess(15);
   * const valid = result.filter(
   *   val => val >= 18,
   *   val => `Age ${val} is under 18`
   * ); // ErrorResult("Age 15 is under 18")
   * ```
   */
  filter<E2>(
    predicate: (value: T) => boolean,
    errorFactory: (value: T) => E2
  ): SuccessOrError<T, E2> {
    if (!predicate(this.value)) {
      return createError(errorFactory(this.value))
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
   * @throws Never throws for SuccessResult
   *
   * @example
   * ```typescript
   * const result = createSuccess(42);
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
   * const result = createSuccess(42);
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
   * const result = createSuccess(42);
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
   * @returns The current `SuccessResult` instance
   *
   * @example
   * ```typescript
   * const result = createSuccess(42);
   * result.inspect(value => console.log(value)); // logs 42
   * ```
   */
  inspect(fn: (value: T) => void): this {
    fn(this.value)
    return this
  }

  /**
   * No-op on `SuccessResult`. Does not execute the callback.
   *
   * @template E - The potential error type
   * @param _fn - Function to execute with the error (not called for success)
   * @returns The current `SuccessResult` instance
   *
   * @example
   * ```typescript
   * const result = createSuccess(42);
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
 * const error = createError({ errorCode: 'NotFound', message: 'User not found' });
 * console.log(error.error.errorCode); // 'NotFound'
 * console.log(error.isError()); // true
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
   * if (result.isSuccess()) {
   *   console.log(result.value);
   * }
   * ```
   */
  isSuccess(): this is never {
    return false
  }

  /**
   * Type guard that returns true if this is an error result.
   * Enables TypeScript to narrow the type in conditional blocks.
   *
   * @example
   * ```typescript
   * const result = await fetchUser(1);
   * if (result.isError()) {
   *   // TypeScript knows result.error exists here
   *   console.log(result.error.errorCode);
   * }
   * ```
   */
  isError(): this is ErrorResult<E> {
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
   * const result = createError({ errorCode: 'NotFound' });
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
   * const result = createError({ errorCode: 'NotFound' });
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
   * const result = createError({ errorCode: 'InvalidInput' });
   * const chained = result.flatMap(value => fetchData(value));
   * // chained is still the original error
   * ```
   */
  flatMap<U, F>(_fn: (value: never) => SuccessOrError<U, F>): ErrorResult<E> {
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
   * const result = createError("network error");
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
   * const result = createError("network error");
   * const flatMapped = await result.flatMapAsync(async id => fetchUserAsync(id)); // ErrorResult("network error")
   * ```
   */
  async flatMapAsync<U = never, E2 = never>(
    _fn: (value: never) => Promise<SuccessOrError<U, E2>>
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
   * const result = createError("initial error");
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
   * const result = createError({ errorCode: 'NotFound' });
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
   * const result = createError({ errorCode: 'NotFound' });
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
   * const result = createError({ errorCode: 'NotFound', userId: 123 });
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
   * const result = createError("failed");
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
   * const result = createError("failed");
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
 * type ApiResult = SuccessOrError<User, { errorCode: 'NotFound' | 'Forbidden' }>;
 *
 * async function getUser(id: number): Promise<ApiResult> {
 *   // ...
 * }
 * ```
 */
export type SuccessOrError<T, E> = SuccessResult<T> | ErrorResult<E>

/**
 * Creates a success result containing the provided value.
 *
 * @template T - The type of the success value
 * @param value - The success value
 * @returns A SuccessResult containing the value
 *
 * @example
 * ```typescript
 * const result = createSuccess({ id: 1, name: 'John' });
 * ```
 */
export function createSuccess<T>(value: T): SuccessResult<T> {
  return new SuccessResult(value)
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
 * const result = createError({ errorCode: 'NotFound', message: 'User not found' });
 * ```
 */
export function createError<E>(error: E): ErrorResult<E> {
  return new ErrorResult(error)
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
  createSuccess,

  /**
   * Creates an error result.
   */
  createError,

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
   * if (result.isSuccess()) {
   *   console.log(result.value);
   * }
   * ```
   */
  async fromPromise<T, E = unknown>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<SuccessOrError<T, E>> {
    try {
      const value = await promise
      return createSuccess(value)
    } catch (e) {
      return createError(errorMapper ? errorMapper(e) : e) as SuccessOrError<T, E>
    }
  },

  /**
   * Wraps a function that may throw into a Result.
   *
   * @template T - The return type of the function
   * @template E - The error type (defaults to unknown)
   * @param fn - The function to wrap
   * @param errorMapper - Optional function to transform caught errors
   * @returns A Result containing either the return value or the error
   *
   * @example
   * ```typescript
   * const result = Result.fromThrowable(
   *   () => JSON.parse(userInput),
   *   (e) => ({ errorCode: 'InvalidJSON' as const, message: String(e) })
   * );
   *
   * const data = result.unwrapOr({ default: true });
   * ```
   */
  fromThrowable<T, E = unknown>(
    fn: () => T,
    errorMapper?: (error: unknown) => E
  ): SuccessOrError<T, E> {
    try {
      return createSuccess(fn())
    } catch (e) {
      return createError(errorMapper ? errorMapper(e) : e) as SuccessOrError<T, E>
    }
  },

  /**
   * Wraps an asynchronous function that may reject/throw into a Result-returning function.
   *
   * @template T The return type of the async function
   * @template E The error type (defaults to unknown)
   * @template A The arguments array type of the wrapped function
   * @param fn The async function to wrap
   * @param errorMapper Optional function to transform caught errors
   * @returns A function that returns a Promise resolving to a SuccessOrError
   *
   * @example
   * ```typescript
   * const safeFetchUser = Result.fromAsyncThrowable(
   *   async (id: number) => {
   *     const res = await fetch(`/api/users/${id}`)
   *     if (!res.ok) throw new Error('Failed to fetch')
   *     return res.json()
   *   },
   *   (e) => ({ errorCode: 'FetchError' as const, cause: String(e) })
   * )
   *
   * const result = await safeFetchUser(1)
   * ```
   */
  fromAsyncThrowable<T, E = unknown, A extends unknown[] = unknown[]>(
    fn: (...args: A) => Promise<T>,
    errorMapper?: (error: unknown) => E
  ): (...args: A) => Promise<SuccessOrError<T, E>> {
    return async (...args: A): Promise<SuccessOrError<T, E>> => {
      try {
        const value = await fn(...args)
        return createSuccess(value)
      } catch (e) {
        return createError(errorMapper ? errorMapper(e) : e) as SuccessOrError<T, E>
      }
    }
  },

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
   * if (combined.isSuccess()) {
   *   const [user, posts, settings] = combined.value;
   *   // All three succeeded
   * } else {
   *   // At least one failed
   *   console.error(combined.error);
   * }
   * ```
   */
  all<T extends readonly SuccessOrError<unknown, unknown>[]>(
    results: T
  ): SuccessOrError<
    {
      -readonly [K in keyof T]: T[K] extends SuccessOrError<infer U, unknown> ? U : never
    },
    T[number] extends SuccessOrError<unknown, infer E> ? E : never
  > {
    const values: unknown[] = []
    for (const result of results) {
      if (result.isError()) {
        return result as ErrorResult<T[number] extends SuccessOrError<unknown, infer E> ? E : never>
      }
      values.push(result.value)
    }
    return createSuccess(values) as SuccessResult<{
      -readonly [K in keyof T]: T[K] extends SuccessOrError<infer U, unknown> ? U : never
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
   * // settled.isSuccess() is always true
   * const results = settled.value; // Array of SuccessOrError<User, FetchError>
   *
   * results.forEach((result, index) => {
   *   if (result.isSuccess()) {
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
   *   createSuccess(1),
   *   createError('error A'),
   *   createError('error B'),
   * ];
   *
   * Result.all(results);        // ErrorResult - short-circuits on first error
   * Result.allSettled(results); // SuccessResult with 3-item array (all Results)
   * ```
   */
  allSettled<T extends readonly SuccessOrError<unknown, unknown>[]>(results: T): SuccessResult<T> {
    return createSuccess(results)
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
   *   createSuccess({ id: 1, name: 'Alice' }),
   *   createError({ errorCode: 'NotFound' }),
   *   createSuccess({ id: 3, name: 'Charlie' }),
   * ];
   *
   * const partitioned = Result.partition(userResults);
   * const { values: users, errors } = partitioned.value;
   *
   * // users = [{ id: 1, name: 'Alice' }, { id: 3, name: 'Charlie' }]
   * // errors = [{ errorCode: 'NotFound' }]
   * ```
   */
  partition<T extends readonly SuccessOrError<unknown, unknown>[]>(
    results: T
  ): SuccessResult<{
    values: {
      -readonly [K in keyof T]: T[K] extends SuccessOrError<infer U, unknown> ? U : never
    }
    errors: Array<T[number] extends SuccessOrError<unknown, infer E> ? E : never>
  }> {
    const values: unknown[] = []
    const errors: unknown[] = []

    for (const result of results) {
      if (result.isSuccess()) {
        values.push(result.value)
      } else {
        errors.push(result.error)
      }
    }

    return createSuccess({
      values,
      errors,
    }) as SuccessResult<{
      values: {
        -readonly [K in keyof T]: T[K] extends SuccessOrError<infer U, unknown> ? U : never
      }
      errors: Array<T[number] extends SuccessOrError<unknown, infer E> ? E : never>
    }>
  },

  /**
   * Checks if a value is a Result (either SuccessResult or ErrorResult).
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
   *   if (maybeResult.isSuccess()) {
   *     console.log(maybeResult.value);
   *   }
   * }
   * ```
   */
  isResult<T = unknown, E = unknown>(value: unknown): value is SuccessOrError<T, E> {
    return value instanceof SuccessResult || value instanceof ErrorResult
  },

  /**
   * Executes a generator function whose body delegates to `SuccessOrError` values with `yield*`.
   * Each yielded success value is unwrapped and fed back into the generator, and the first error
   * result is returned immediately without continuing execution.
   *
   * @template R - The final return type produced by the generator.
   * @template T - The success value type yielded and sent back into the generator.
   * @template E - The error type carried by `ErrorResult`.
   * @param fn - A generator function that delegates to `SuccessOrError` values using `yield*`.
   * @returns A `SuccessResult<R>` when the generator completes successfully, or the first `ErrorResult<E>`.
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
  gen<T, E = never>(fn: () => Generator<SuccessOrError<T, E>, T, T>): SuccessOrError<T, E> {
    const iterator = fn()
    let state = iterator.next()

    while (!state.done) {
      const result = state.value
      if (result.isError()) {
        return result
      }
      state = iterator.next(result.unwrap())
    }

    return createSuccess(state.value)
  },
} as const
