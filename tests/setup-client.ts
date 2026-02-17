import "@testing-library/jest-dom/vitest"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })
Object.defineProperty(globalThis, "sessionStorage", { value: sessionStorageMock })

// Mock AudioContext
class MockAudioContext {
  currentTime = 0
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      type: "sine",
      frequency: { setValueAtTime: () => {} },
    }
  }
  createGain() {
    return {
      connect: () => {},
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    }
  }
  get destination() {
    return {}
  }
}

Object.defineProperty(globalThis, "AudioContext", { value: MockAudioContext })

// Reset storages between tests
beforeEach(() => {
  localStorageMock.clear()
  sessionStorageMock.clear()
})
