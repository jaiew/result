import { describe, it, expect } from 'vitest'
import { createSuccess, createError, Result } from './index.js'

describe('Result Utility Library Suite', () => {
  describe('Basic Creation and Type Guards', () => {
    it('should correctly build and guard a SuccessResult', () => {
      const res = createSuccess('hello')

      expect(res.kind).toBe('success')
      expect(res.value).toBe('hello')
      expect(res.isSuccess()).toBe(true)
      expect(res.isError()).toBe(false)
    })

    it('should correctly build and guard an ErrorResult', () => {
      const res = createError({ code: 404 })

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
