import { describe, it, expect, vi } from 'vitest'
import { ok, err, Result } from './index.js'

describe('Result Utility Library Suite', () => {
  describe('Basic Creation and Type Guards', () => {
    it('should correctly build and guard a OkResult', () => {
      const res = Result.ok('hello')

      expect(res.kind).toBe('success')
      expect(res.value).toBe('hello')
      expect(res.isOk()).toBe(true)
      expect(res.isErr()).toBe(false)
    })

    it('should correctly build and guard an ErrorResult', () => {
      const res = Result.err({ code: 404 })

      expect(res.kind).toBe('error')
      expect(res.error).toEqual({ code: 404 })
      expect(res.isOk()).toBe(false)
      expect(res.isErr()).toBe(true)
    })
  })

  describe('Transformations (map, mapError, flatMap)', () => {
    it('should apply map on success and ignore it on error', () => {
      const successRes = ok(10).map((x) => x * 2)
      expect(successRes.unwrap()).toBe(20)

      const errorRes = err<string>('failed').map((x: never) => x + '!!')
      expect(errorRes.isErr()).toBe(true)
      expect(errorRes.error).toBe('failed')
    })

    it('should apply mapError on error and ignore it on success', () => {
      const errorRes = err('failed').mapError((err) => err.toUpperCase())
      expect(errorRes.error).toBe('FAILED')

      const successRes = ok<number>(10).mapError((_err: never) => 'new error')
      expect(successRes.unwrap()).toBe(10)
    })

    it('should apply flatMap to chain results on success and bypass on error', () => {
      const successChain = ok(5).flatMap((val) => ok(val + 5))
      expect(successChain.unwrap()).toBe(10)

      const successToErrorChain = ok(5).flatMap(() => err('short circuit'))
      expect(successToErrorChain.isErr()).toBe(true)
      expect(successToErrorChain.unwrapOr('fallback')).toBe('fallback')

      const errorChain = err<string>('initial error').flatMap(() => ok('ignored'))
      expect(errorChain.isErr()).toBe(true)
      expect(errorChain.error).toBe('initial error')
    })
  })

  describe('Side-Effect Inspection (inspect, inspectError)', () => {
    it('should call inspect callback on OkResult and skip on ErrorResult', () => {
      const successFn = vi.fn()
      const successRes = ok('data').inspect(successFn)

      expect(successFn).toHaveBeenCalledTimes(1)
      expect(successFn).toHaveBeenCalledWith('data')
      expect(successRes.unwrap()).toBe('data')

      const errorFn = vi.fn()
      const errorRes = err('failed').inspect(errorFn)

      expect(errorFn).not.toHaveBeenCalled()
      expect(errorRes.isErr()).toBe(true)
    })

    it('should call inspectError callback on ErrorResult and skip on OkResult', () => {
      const errorFn = vi.fn()
      const errorRes = err('failed').inspectError(errorFn)

      expect(errorFn).toHaveBeenCalledTimes(1)
      expect(errorFn).toHaveBeenCalledWith('failed')
      expect(errorRes.error).toBe('failed')

      const successFn = vi.fn()
      const successRes = ok('data').inspectError(successFn)

      expect(successFn).not.toHaveBeenCalled()
      expect(successRes.unwrap()).toBe('data')
    })
  })

  describe('Predicate Validation (filter)', () => {
    it('should retain OkResult if predicate returns true', () => {
      const res = ok(20).filter(
        (val) => val >= 18,
        (val) => `Underage: ${val}`
      )

      expect(res.isOk()).toBe(true)
      expect(res.unwrap()).toBe(20)
    })

    it('should convert OkResult to ErrorResult if predicate returns false', () => {
      const res = ok(15).filter(
        (val) => val >= 18,
        (val) => `Underage: ${val}`
      )

      expect(res.isErr()).toBe(true)
      expect(res.unwrapOrElse((err) => err)).toBe('Underage: 15')
    })

    it('should ignore filter predicate on ErrorResult', () => {
      const predicate = vi.fn(() => true)
      const errorFactory = vi.fn(() => 'new error')

      const res = err('original error').filter(predicate, errorFactory)

      expect(predicate).not.toHaveBeenCalled()
      expect(errorFactory).not.toHaveBeenCalled()
      expect(res.isErr()).toBe(true)
      expect(res.error).toBe('original error')
    })
  })

  describe('Async Transformations (mapAsync, flatMapAsync)', () => {
    it('should transform success values asynchronously using mapAsync', async () => {
      const res = await ok(10).mapAsync(async (val) => val * 3)

      expect(res.isOk()).toBe(true)
      expect(res.unwrap()).toBe(30)

      const errorRes = await err<string>('error').mapAsync(async (val: never) => val * 3)
      expect(errorRes.isErr()).toBe(true)
      expect(errorRes.error).toBe('error')
    })

    it('should chain async results using flatMapAsync', async () => {
      const res = await ok('user_1').flatMapAsync(async (id) => ok(`profile_${id}`))

      expect(res.isOk()).toBe(true)
      expect(res.unwrap()).toBe('profile_user_1')

      const errRes = await ok('user_1').flatMapAsync(async () => err('fetch_failed'))

      expect(errRes.isErr()).toBe(true)
      expect(errRes.unwrapOrElse((error) => error)).toBe('fetch_failed')

      const bypassedErr = await err<string>('initial_fail').flatMapAsync(async () => ok('ignored'))

      expect(bypassedErr.isErr()).toBe(true)
      expect(bypassedErr.error).toBe('initial_fail')
    })
  })

  describe('Generator Composition (Result.gen)', () => {
    it('should successfully run a generator flow unwrapping all yield* results', () => {
      const result = Result.gen(function* () {
        const a = yield* ok(10)
        const b = yield* ok(20)
        return a + b
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(30)
    })

    it('should unwrap success values and continue generator execution', () => {
      const result = Result.gen(function* () {
        const first: number = yield ok(10)
        const second: number = yield ok(20)

        return first + second
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(30)
    })

    it('should short-circuit generator execution on the first encountered ErrorResult', () => {
      const secondStepFn = vi.fn()

      const result = Result.gen(function* () {
        const a = yield* ok(10)
        if (a === 10) {
          yield* err('step_1_failed')
        }
        secondStepFn()
        return a
      })

      expect(secondStepFn).not.toHaveBeenCalled()
      expect(result.isErr()).toBe(true)
      expect(result.unwrapOrElse((err) => err)).toBe('step_1_failed')
    })

    it('should correctly infer and handle heterogeneous result types in Result.gen', () => {
      type User = { id: number; name: string }
      type Role = { roleId: string; permissions: string[] }
      type CustomError = { code: string }

      const getUser = (id: number): Result<User, CustomError> => ok({ id, name: 'Alice' })

      const getRole = (user: User): Result<Role, CustomError> =>
        ok({ roleId: `role_for_${user.id}`, permissions: ['read', 'write'] })

      const combinedResult = Result.gen(function* () {
        // 1st yield: OkResult<User> -> yields User
        const user: User = yield* getUser(1)

        // 2nd yield: OkResult<Role> -> yields Role (heterogeneous type step)
        const role: Role = yield* getRole(user)

        return {
          userId: user.id,
          roleId: role.roleId,
          permissions: role.permissions,
        }
      })

      expect(combinedResult.isOk()).toBe(true)
      expect(combinedResult.unwrap()).toEqual({
        userId: 1,
        roleId: 'role_for_1',
        permissions: ['read', 'write'],
      })
    })
  })

  describe('Pattern Matching', () => {
    it('should execute onSuccess handler for OkResult', () => {
      const res = ok('data')
      const output = res.match({
        onSuccess: (val) => `Success: ${val}`,
        onError: () => 'Error occurred',
      })
      expect(output).toBe('Success: data')
    })

    it('should execute onError handler for ErrorResult', () => {
      const res = err('timeout')
      const output = res.match({
        onSuccess: () => 'Success path',
        onError: (err) => `Error: ${err}`,
      })
      expect(output).toBe('Error: timeout')
    })
  })

  describe('Unwrapping Utilities', () => {
    it('should unwrap success values smoothly or throw clean errors on failure', () => {
      expect(ok('valid').unwrap()).toBe('valid')
      expect(() => err('invalid').unwrap()).toThrow('Called unwrap() on ErrorResult: "invalid"')
    })

    it('should fallback correctly using unwrapOr', () => {
      expect(ok('primary').unwrapOr('backup')).toBe('primary')
      expect(err('fail').unwrapOr('backup')).toBe('backup')
    })

    it('should fallback dynamically using unwrapOrElse', () => {
      expect(ok(50).unwrapOrElse(() => 0)).toBe(50)
      expect(err('dynamic fail').unwrapOrElse((err) => err.length)).toBe(12)
    })
  })

  describe('Result.try', () => {
    describe('synchronous execution', () => {
      it('returns OkResult for non-throwing functions', () => {
        const res = Result.try(() => 42)
        expect(res.isOk()).toBe(true)
        expect(res.unwrap()).toBe(42)
      })

      it('returns ErrorResult after throwing with no error mapper', () => {
        const res = Result.try<never, Error>(() => {
          throw new Error('sync fail')
        })
        expect(res.isErr()).toBe(true)
        expect(res.isErr() && res.error.message).toBe('sync fail')
      })

      it('returns ErrorResult for throwing functions', () => {
        const res = Result.try(
          () => {
            throw new Error('sync fail')
          },
          (err) => (err as Error).message
        )
        expect(res.isErr()).toBe(true)
        expect(res.isErr() && res.error).toBe('sync fail')
      })
    })

    describe('asynchronous execution', () => {
      it('returns a Promise resolving to OkResult when async fn resolves', async () => {
        const res = await Result.try(async () => 'async success')
        expect(res.isOk()).toBe(true)
        expect(res.unwrap()).toBe('async success')
      })

      it('returns a Promise resolving to ErrorResult when async fn rejects with no error Mapper', async () => {
        const res = await Result.try<never, Error>(async () => {
          throw new Error('async fail')
        })
        expect(res.isErr()).toBe(true)
        expect(res.isErr() && res.error.message).toBe('async fail')
      })

      it('returns a Promise resolving to ErrorResult when async fn rejects', async () => {
        const res = await Result.try(
          async () => {
            throw new Error('async fail')
          },
          (err) => (err as Error).message
        )
        expect(res.isErr()).toBe(true)
        expect(res.isErr() && res.error).toBe('async fail')
      })
    })
  })

  describe('Result Namespace Async / Sync Wrappers', () => {
    it('should wrap resolving and rejecting promises via fromPromise', async () => {
      const successPromise = await Result.fromPromise(Promise.resolve('async data'))
      expect(successPromise.unwrap()).toBe('async data')

      const failurePromise = await Result.fromPromise(Promise.reject('async network failure'))
      expect(failurePromise.isErr()).toBe(true)
      expect(failurePromise.unwrapOr('caught')).toBe('caught')

      const mappedFailurePromise = await Result.fromPromise(
        Promise.reject('network error'),
        (e) => `Mapped: ${e}`
      )
      expect(mappedFailurePromise.isErr()).toBe(true)
      expect(mappedFailurePromise.unwrapOrElse((err) => err)).toBe('Mapped: network error')
    })
  })

  describe('Combinators and Type Utilities (all, allSettled, partition, isResult)', () => {
    it('should short-circuit fast on first error encountered using Result.all', () => {
      const combinedSuccess = Result.all([ok(1), ok(2)])
      expect(combinedSuccess.unwrap()).toEqual([1, 2])

      const combinedMixed = Result.all([ok(1), err('err alpha'), err('err beta')])
      expect(combinedMixed.isErr()).toBe(true)
      expect(combinedMixed.unwrapOr([])).toEqual([])

      const combinedEmpty = Result.all([])
      expect(combinedEmpty.unwrap()).toEqual([])
    })

    it('should preserve all individual results without throwing via allSettled', () => {
      const resultsArray = [ok('ok'), err('bad')]
      const settled = Result.allSettled(resultsArray)

      expect(settled.isOk()).toBe(true)
      expect(settled.unwrap()).toEqual(resultsArray)
    })

    it('should completely partition success values and error messages safely', () => {
      const payload = [ok('A'), err('E1'), ok('B'), err('E2')]
      const partitioned = Result.partition(payload)

      expect(partitioned.isOk()).toBe(true)
      expect(partitioned.unwrap().values).toEqual(['A', 'B'])
      expect(partitioned.unwrap().errors).toEqual(['E1', 'E2'])
    })

    it('should cleanly identify variations of Result objects via isResult', () => {
      expect(Result.isResult(ok(10))).toBe(true)
      expect(Result.isResult(err('error'))).toBe(true)
      expect(Result.isResult({ kind: 'success', value: 10 })).toBe(false)
      expect(Result.isResult(null)).toBe(false)
      expect(Result.isResult(undefined)).toBe(false)
    })
  })
})
