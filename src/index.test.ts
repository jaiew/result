import { describe, it, expect, vi } from 'vitest'
import { createSuccess, createError, Result } from './index.js'

describe('Result Utility Library Suite', () => {
  describe('Basic Creation and Type Guards', () => {
    it('should correctly build and guard a SuccessResult', () => {
      const res = Result.createSuccess('hello')

      expect(res.kind).toBe('success')
      expect(res.value).toBe('hello')
      expect(res.isSuccess()).toBe(true)
      expect(res.isError()).toBe(false)
    })

    it('should correctly build and guard an ErrorResult', () => {
      const res = Result.createError({ code: 404 })

      expect(res.kind).toBe('error')
      expect(res.error).toEqual({ code: 404 })
      expect(res.isSuccess()).toBe(false)
      expect(res.isError()).toBe(true)
    })
  })

  describe('Transformations (map, mapError, flatMap)', () => {
    it('should apply map on success and ignore it on error', () => {
      const successRes = createSuccess(10).map((x) => x * 2)
      expect(successRes.unwrap()).toBe(20)

      const errorRes = createError<string>('failed').map((x: never) => x + '!!')
      expect(errorRes.isError()).toBe(true)
      expect(errorRes.error).toBe('failed')
    })

    it('should apply mapError on error and ignore it on success', () => {
      const errorRes = createError('failed').mapError((err) => err.toUpperCase())
      expect(errorRes.error).toBe('FAILED')

      const successRes = createSuccess<number>(10).mapError((_err: never) => 'new error')
      expect(successRes.unwrap()).toBe(10)
    })

    it('should apply flatMap to chain results on success and bypass on error', () => {
      const successChain = createSuccess(5).flatMap((val) => createSuccess(val + 5))
      expect(successChain.unwrap()).toBe(10)

      const successToErrorChain = createSuccess(5).flatMap(() => createError('short circuit'))
      expect(successToErrorChain.isError()).toBe(true)
      expect(successToErrorChain.unwrapOr('fallback')).toBe('fallback')

      const errorChain = createError<string>('initial error').flatMap(() =>
        createSuccess('ignored')
      )
      expect(errorChain.isError()).toBe(true)
      expect(errorChain.error).toBe('initial error')
    })
  })

  describe('Side-Effect Inspection (inspect, inspectError)', () => {
    it('should call inspect callback on SuccessResult and skip on ErrorResult', () => {
      const successFn = vi.fn()
      const successRes = createSuccess('data').inspect(successFn)

      expect(successFn).toHaveBeenCalledTimes(1)
      expect(successFn).toHaveBeenCalledWith('data')
      expect(successRes.unwrap()).toBe('data')

      const errorFn = vi.fn()
      const errorRes = createError('failed').inspect(errorFn)

      expect(errorFn).not.toHaveBeenCalled()
      expect(errorRes.isError()).toBe(true)
    })

    it('should call inspectError callback on ErrorResult and skip on SuccessResult', () => {
      const errorFn = vi.fn()
      const errorRes = createError('failed').inspectError(errorFn)

      expect(errorFn).toHaveBeenCalledTimes(1)
      expect(errorFn).toHaveBeenCalledWith('failed')
      expect(errorRes.error).toBe('failed')

      const successFn = vi.fn()
      const successRes = createSuccess('data').inspectError(successFn)

      expect(successFn).not.toHaveBeenCalled()
      expect(successRes.unwrap()).toBe('data')
    })
  })

  describe('Predicate Validation (filter)', () => {
    it('should retain SuccessResult if predicate returns true', () => {
      const res = createSuccess(20).filter(
        (val) => val >= 18,
        (val) => `Underage: ${val}`
      )

      expect(res.isSuccess()).toBe(true)
      expect(res.unwrap()).toBe(20)
    })

    it('should convert SuccessResult to ErrorResult if predicate returns false', () => {
      const res = createSuccess(15).filter(
        (val) => val >= 18,
        (val) => `Underage: ${val}`
      )

      expect(res.isError()).toBe(true)
      expect(res.unwrapOrElse((err) => err)).toBe('Underage: 15')
    })

    it('should ignore filter predicate on ErrorResult', () => {
      const predicate = vi.fn(() => true)
      const errorFactory = vi.fn(() => 'new error')

      const res = createError('original error').filter(predicate, errorFactory)

      expect(predicate).not.toHaveBeenCalled()
      expect(errorFactory).not.toHaveBeenCalled()
      expect(res.isError()).toBe(true)
      expect(res.error).toBe('original error')
    })
  })

  describe('Async Transformations (mapAsync, flatMapAsync)', () => {
    it('should transform success values asynchronously using mapAsync', async () => {
      const res = await createSuccess(10).mapAsync(async (val) => val * 3)

      expect(res.isSuccess()).toBe(true)
      expect(res.unwrap()).toBe(30)

      const errorRes = await createError<string>('error').mapAsync(async (val: never) => val * 3)
      expect(errorRes.isError()).toBe(true)
      expect(errorRes.error).toBe('error')
    })

    it('should chain async results using flatMapAsync', async () => {
      const res = await createSuccess('user_1').flatMapAsync(async (id) =>
        createSuccess(`profile_${id}`)
      )

      expect(res.isSuccess()).toBe(true)
      expect(res.unwrap()).toBe('profile_user_1')

      const errRes = await createSuccess('user_1').flatMapAsync(async () =>
        createError('fetch_failed')
      )

      expect(errRes.isError()).toBe(true)
      expect(errRes.unwrapOrElse((error) => error)).toBe('fetch_failed')

      const bypassedErr = await createError<string>('initial_fail').flatMapAsync(async () =>
        createSuccess('ignored')
      )

      expect(bypassedErr.isError()).toBe(true)
      expect(bypassedErr.error).toBe('initial_fail')
    })
  })

  describe('Generator Composition (Result.gen)', () => {
    it('should successfully run a generator flow unwrapping all yield* results', () => {
      const result = Result.gen(function* () {
        const a = yield* createSuccess(10)
        const b = yield* createSuccess(20)
        return a + b
      })

      expect(result.isSuccess()).toBe(true)
      expect(result.unwrap()).toBe(30)
    })

    it('should unwrap success values and continue generator execution', () => {
      const result = Result.gen(function* () {
        const first: number = yield createSuccess(10)
        const second: number = yield createSuccess(20)

        return first + second
      })

      expect(result.isSuccess()).toBe(true)
      expect(result.unwrap()).toBe(30)
    })

    it('should short-circuit generator execution on the first encountered ErrorResult', () => {
      const secondStepFn = vi.fn()

      const result = Result.gen(function* () {
        const a = yield* createSuccess(10)
        if (a === 10) {
          yield* createError('step_1_failed')
        }
        secondStepFn()
        return a
      })

      expect(secondStepFn).not.toHaveBeenCalled()
      expect(result.isError()).toBe(true)
      expect(result.unwrapOrElse((err) => err)).toBe('step_1_failed')
    })
  })

  describe('Pattern Matching', () => {
    it('should execute onSuccess handler for SuccessResult', () => {
      const res = createSuccess('data')
      const output = res.match({
        onSuccess: (val) => `Success: ${val}`,
        onError: () => 'Error occurred',
      })
      expect(output).toBe('Success: data')
    })

    it('should execute onError handler for ErrorResult', () => {
      const res = createError('timeout')
      const output = res.match({
        onSuccess: () => 'Success path',
        onError: (err) => `Error: ${err}`,
      })
      expect(output).toBe('Error: timeout')
    })
  })

  describe('Unwrapping Utilities', () => {
    it('should unwrap success values smoothly or throw clean errors on failure', () => {
      expect(createSuccess('valid').unwrap()).toBe('valid')
      expect(() => createError('invalid').unwrap()).toThrow(
        'Called unwrap() on ErrorResult: "invalid"'
      )
    })

    it('should fallback correctly using unwrapOr', () => {
      expect(createSuccess('primary').unwrapOr('backup')).toBe('primary')
      expect(createError('fail').unwrapOr('backup')).toBe('backup')
    })

    it('should fallback dynamically using unwrapOrElse', () => {
      expect(createSuccess(50).unwrapOrElse(() => 0)).toBe(50)
      expect(createError('dynamic fail').unwrapOrElse((err) => err.length)).toBe(12)
    })
  })

  describe('Result Namespace Async / Sync Wrappers', () => {
    it('should handle successful and throwing operations via fromThrowable', () => {
      const safeFn = Result.fromThrowable(() => JSON.parse('{"valid": true}'))
      expect(safeFn.isSuccess()).toBe(true)

      const unsafeFn = Result.fromThrowable(() => JSON.parse('{invalid json}'))
      expect(unsafeFn.isError()).toBe(true)

      const mappedUnsafeFn = Result.fromThrowable(
        () => JSON.parse('{invalid json}'),
        (_e) => new Error('Custom Parse Error')
      )
      expect(mappedUnsafeFn.isError()).toBe(true)
      expect(mappedUnsafeFn.unwrapOrElse((err: Error) => err.message)).toBe('Custom Parse Error')
    })

    it('should return a SuccessResult when the async function resolves', async () => {
      const asyncFn = async (a: number, b: number) => a + b
      const safeFn = Result.fromAsyncThrowable(asyncFn)

      const result = await safeFn(5, 10)

      expect(result.isSuccess()).toBe(true)
      expect(result.unwrap()).toBe(15)
    })

    it('should return an ErrorResult when the async function rejects (without mapper)', async () => {
      const asyncFn = async () => {
        throw new Error('Async error')
      }
      const safeFn = Result.fromAsyncThrowable(asyncFn)

      const result = await safeFn()

      expect(result.isError()).toBe(true)
      if (result.isError()) {
        expect(result.error).toBeInstanceOf(Error)
        expect((result.error as Error).message).toBe('Async error')
      }
    })

    it('should apply errorMapper when the async function rejects', async () => {
      const asyncFn = async () => {
        throw new Error('Async failure')
      }
      const safeFn = Result.fromAsyncThrowable(asyncFn, (err) => ({
        code: 'ASYNC_ERROR',
        message: (err as Error).message,
      }))

      const result = await safeFn()

      expect(result.isError()).toBe(true)
      if (result.isError()) {
        expect(result.error).toEqual({
          code: 'ASYNC_ERROR',
          message: 'Async failure',
        })
      } else {
        expect.unreachable('result should be an error')
      }
    })

    it('should wrap resolving and rejecting promises via fromPromise', async () => {
      const successPromise = await Result.fromPromise(Promise.resolve('async data'))
      expect(successPromise.unwrap()).toBe('async data')

      const failurePromise = await Result.fromPromise(Promise.reject('async network failure'))
      expect(failurePromise.isError()).toBe(true)
      expect(failurePromise.unwrapOr('caught')).toBe('caught')

      const mappedFailurePromise = await Result.fromPromise(
        Promise.reject('network error'),
        (e) => `Mapped: ${e}`
      )
      expect(mappedFailurePromise.isError()).toBe(true)
      expect(mappedFailurePromise.unwrapOrElse((err) => err)).toBe('Mapped: network error')
    })
  })

  describe('Combinators and Type Utilities (all, allSettled, partition, isResult)', () => {
    it('should short-circuit fast on first error encountered using Result.all', () => {
      const combinedSuccess = Result.all([createSuccess(1), createSuccess(2)])
      expect(combinedSuccess.unwrap()).toEqual([1, 2])

      const combinedMixed = Result.all([
        createSuccess(1),
        createError('err alpha'),
        createError('err beta'),
      ])
      expect(combinedMixed.isError()).toBe(true)
      expect(combinedMixed.unwrapOr([])).toEqual([])

      const combinedEmpty = Result.all([])
      expect(combinedEmpty.unwrap()).toEqual([])
    })

    it('should preserve all individual results without throwing via allSettled', () => {
      const resultsArray = [createSuccess('ok'), createError('bad')]
      const settled = Result.allSettled(resultsArray)

      expect(settled.isSuccess()).toBe(true)
      expect(settled.unwrap()).toEqual(resultsArray)
    })

    it('should completely partition success values and error messages safely', () => {
      const payload = [createSuccess('A'), createError('E1'), createSuccess('B'), createError('E2')]
      const partitioned = Result.partition(payload)

      expect(partitioned.isSuccess()).toBe(true)
      expect(partitioned.unwrap().values).toEqual(['A', 'B'])
      expect(partitioned.unwrap().errors).toEqual(['E1', 'E2'])
    })

    it('should cleanly identify variations of Result objects via isResult', () => {
      expect(Result.isResult(createSuccess(10))).toBe(true)
      expect(Result.isResult(createError('error'))).toBe(true)
      expect(Result.isResult({ kind: 'success', value: 10 })).toBe(false)
      expect(Result.isResult(null)).toBe(false)
      expect(Result.isResult(undefined)).toBe(false)
    })
  })
})
