import * as ds from "@devicescript/core"

export type SuiteFunction = () => void
export type TestFunction = () => ds.AsyncVoid
export enum TestState {
    NotRun,
    Running,
    Passed,
    Error,
    Ignored,
}
export class AssertionError extends Error {
    constructor(matcher: string, message: string) {
        super()
        this.name = "AssertionError"
        this.message = `${matcher}: ${message}`
    }
}
export class SuiteNode {
    readonly children: SuiteNode[] = []
    readonly tests: TestNode[] = []

    constructor(public name: string) {}

    testCount(): number {
        return (
            this.tests.length +
            this.children.reduce<number>(
                (prev, curr) => prev + curr.testCount(),
                0
            )
        )
    }

    async run() {
        console.log(` ${this.name}`)
        for (const child of this.children) {
            await child.run()
        }
        for (const test of this.tests) {
            await test.run()
        }
    }

    private testsByState(testState: TestState): number {
        return (
            this.tests.filter(({ state }) => state === testState).length +
            this.children.reduce<number>(
                (prev, curr) => prev + curr.testsByState(testState),
                0
            )
        )
    }

    async summary() {
        const tests = this.testCount()
        const passed = this.testsByState(TestState.Passed)
        const error = this.testsByState(TestState.Error)
        const ignored = this.testsByState(TestState.Ignored)

        console.log(
            `tests: ${tests}, passed: ${passed}, error: ${error}, ignore: ${ignored}`
        )
    }
}
export class TestNode {
    state: TestState = TestState.NotRun
    error: unknown

    constructor(public name: string, public body: TestFunction) {}

    async run() {
        console.log(`  ${this.name}`)
        try {
            this.state = TestState.Running
            this.error = undefined

            await this.body()

            this.state = TestState.Passed
        } catch (error: unknown) {
            this.state = TestState.Error
            this.error = error
        }
    }
}

export const root = new SuiteNode("")
const stack: SuiteNode[] = [root]

function currentSuite() {
    const parent = stack[stack.length - 1]
    return parent
}

export function describe(name: string, body: SuiteFunction) {
    const node = new SuiteNode(name)

    const parent = currentSuite()
    parent.children.push(node)

    try {
        stack.push(node)
        body()
    } finally {
        stack.pop()
    }
}

export function test(name: string, body: TestFunction) {
    const parent = currentSuite()
    parent.tests.push(new TestNode(name, body))
}

export const it = test

export function expect<T>(value: T) {
    return new Expect(value, false)
}
export class Expect<T> {
    constructor(readonly value: T, private readonly _not: boolean) {}

    private check(condition: boolean) {
        return this._not ? !condition : condition
    }

    not() {
        return new Expect<T>(this.value, !this._not)
    }

    toThrow() {
        try {
            ;(this.value as any)()
            throw new AssertionError("toThrow", "Expected to throw")
        } catch (e) {}
    }

    toBe(other: T): void {
        if (this.check(other !== this.value))
            throw new AssertionError(
                "toBe",
                `Expected ${this.value}, got ${other}`
            )
    }
}

async function runTests() {
    console.log(`running ${root.testCount()} tests`)
    await root.run()
    await root.summary()
}
runTests()
